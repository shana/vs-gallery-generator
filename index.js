'use strict';
var os = require('os');
var fs = require('fs');
var unzip = require('unzip2')
var parseXml = require('xml2js').parseString;
var js2xml = require("js2xmlparser");
var mkdirp = require('mkdirp');
var events = require('events');
var github = require('./auth.js')

var request = require('request');

var eventEmitter = new events.EventEmitter();
var RELEASE_COUNT = 8;

var theFeed = {
    '@': {
        'xmlns': 'http://www.w3.org/2005/Atom'
    },
    'title': {
        '@': {
            'type': 'text'
        },
        '#': 'GitHub Extension for Visual Studio Releases'
    },
    'id': 'uuid:92f52a00-5ff8-4966-936e-5dfdfb7c9586;id=1',
    'link': {
        '@': {
            'href': 'https://visualstudio.github.com/releases/feed.rss'
            //'href': 'http://spoiledcat.net/x/feed.rss'
        },
    },
    'updated_at': '',
    'entry': [
    ]
};

github.events.on('authenticated', function(token) {
    eventEmitter.emit('begin');
})

eventEmitter.on('start', function(date) {
    theFeed.updated_at = date;
});

eventEmitter.on('process', function(path, release, asset) {
    console.log();
    console.log('Processing asset ' + path + asset.name);
/*
    var options = {
        url: asset.browser_download_url,
        headers: {
            'Accept': asset.content_type
        }
    };

    request(options)
    .on('response', function(response) { console.log('Downloading ' + asset.browser_download_url + ' to ' + path + asset.name) })
    .pipe(fs.createWriteStream(path + asset.name))
    .on('finish', function() {
        */
        fs
        .createReadStream(path + asset.name)
        .pipe(unzip.Parse())
        .on('entry', function(entry) { processZipEntries(path, release, asset, entry); });
    //});
});

eventEmitter.on('finish', function() {
    theFeed.entry.sort(function(a, b) {
        a = new Date(a.updated);
        b = new Date(b.updated);
        return a>b ? -1 : a<b ? 1 : 0;
    });
    var res = js2xml('feed', theFeed);
    var f = fs.createWriteStream(__dirname + '/files/feed.rss');
    f.write(res)
    f.end();

    console.log('DONE!');
});

eventEmitter.on('begin', function() {

    github.releases.listReleases({
        owner: "github",
        repo: "VisualStudio",
        page: 1,
        per_page: 20
    }, function(err, releases) {

        var releasesList = [];
        var total = 0;

        eventEmitter.on('entry', function(r, e) {
            total++;
            theFeed.entry.push(e);
            if (total == releasesList.length)
                eventEmitter.emit('finish');
        })

        var betaCount;
        for (var j = 0; j < releases.length && releasesList.length < RELEASE_COUNT; j++)
        {
            var release = releases[j];
            if (release.draft)
                continue;
            else if (release.prerelease)
            {
                if (release.id < releases[0].id)
                    continue;
                if (betaCount)
                    continue;
                betaCount = true;
            }
            releasesList.push(release);
        }

        eventEmitter.emit('start', releasesList[0].published_at);
        for (var j = 0; j < releasesList.length; j++)
        {
            var release = releasesList[j];

            var path = __dirname + '/files/' + j + '/';
            var id = release.id;
            var assets = release.assets;

            console.log();
            console.log('======================================================================');
            console.log();
            console.log('Processing #' + release.id + ' ' + (release.prerelease ? 'pre' : '') + 'release ' + release.name);
            console.log();
            console.log('======================================================================');
            console.log();
            //console.log(release.body);

            var asset;
            for (var i = 0; i < assets.length; ++i)
            {
                if (assets[i].name.indexOf(".vsix") == assets[i].name.length - 5)
                {
                    asset = assets[i];
                    break;
                }
            }

            if (asset)
            {
                mkdirp.sync(path);
                eventEmitter.emit('process', path, release, asset);
            }
        }
    });
});

function processZipEntries(path, release, asset, entry)
{
    var fileName = entry.path;
    var type = entry.type; // 'Directory' or 'File'
    var size = entry.size;

    if (fileName === "extension.vsixmanifest")
    {
        entry
        .pipe(fs.createWriteStream(path + fileName))
        .on('finish', function() {
            fs.readFile(path + fileName, function(err, data) {
                parseXml(data, function(err, result) {
                    var data = {
                        'id': result.PackageManifest.Metadata[0].Identity[0].$.Id,
                        'name': result.PackageManifest.Metadata[0].DisplayName,
                        //'description': result.PackageManifest.Metadata[0].Description[0]._,
                        'description': release.body,
                        'version': result.PackageManifest.Metadata[0].Identity[0].$.Version,
                        'lang': result.PackageManifest.Metadata[0].Identity[0].$.Language,
                        'author': result.PackageManifest.Metadata[0].Identity[0].$.Publisher,
                        'updated_at': asset.updated_at,
                        'created_at': '2015-05-01T00:00:00-00:00',
                        'url': asset.browser_download_url
                    }
                    //console.log(JSON.stringify(JSON.parse(JSON.stringify(result)),null,'\t'));

                    var item = {
                        'id': data.id,
                        'title': {
                            '@': {
                                'type': 'text'
                            },
                            '#': data.name + ' - v' + data.version + (release.prerelease ? ' (beta)' : ''),
                        },
                        'summary': {
                            '@': {
                                'type': 'text'
                            },
                            '#': data.description,
                        },
                        'published': data.created_at,
                        'updated': data.updated_at,
                        'author': { name: data.author },
                        'link': [
                            {
                                '@': {
                                    'rel': 'icon',
                                    'href': 'https://visualstudio.github.com/releases/feed-icon.png'
                                    //'href': 'http://spoiledcat.net/x/feed-icon.png'
                                },
                            },
                            {
                                '@': {
                                    'rel': 'previewimage',
                                    'href': 'https://visualstudio.github.com/releases/feed-preview.png'
                                    //'href': 'http://spoiledcat.net/x/feed-preview.png'
                                },
                            },
                            {
                                '@': {
                                    'rel': 'alternate',
                                    'href': release.html_url
                                },
                            },
                            {
                                '@': {
                                    'rel': 'releasenotes',
                                    'href': release.html_url
                                },
                            },
                            // don't need this, the content element does the same thing
                            // {
                            //     '@': {
                            //         'rel': 'update',
                            //         'href': data.url
                            //     },
                            // }
                        ],
                        'content': {
                            '@': {
                                'type': 'application/octet-stream',
                                'src': data.url
                            }
                        },
                        'Vsix': {
                            '@': {
                                'xmlns': 'http://schemas.microsoft.com/developer/vsx-syndication-schema/2010'
                            },
                            'Id': data.id,
                            'Version': data.version,
                            'Language': data.lang,
                            'Publisher': data.author
                        }
                    };
                    eventEmitter.emit('entry', release, item);
                });
            });
        });
    } else
        entry.autodrain();
}

github.login();
