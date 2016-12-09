const readlineSync = require('readline-sync');
const util = require('util');
const EventEmitter = require('events');
const GitHubApi = require("github");

if (typeof localStorage === "undefined" || localStorage === null) {
    const LocalStorage = require('node-localstorage').LocalStorage;
    localStorage = new LocalStorage('./scratch');
}

var clientid = process.env.APP_CLIENT_ID;
var clientsecret = process.env.APP_CLIENT_SECRET;
var appname = process.env.APP_NAME;

function MyGitHubApi(config) {
    this.events = new EventEmitter.EventEmitter();
    GitHubApi.call(this, config);
}
util.inherits(MyGitHubApi, GitHubApi);

var github = new MyGitHubApi({
    // required
    version: "3.0.0",
    // optional
    debug: true,
    //    protocol: "https",
    //    host: "api.github.com", // should be api.github.com for GitHub
    //    pathPrefix: "/api/v3", // for some GHEs; none for GitHub
    //timeout: 5000,
    headers: {
        "user-agent": appname // GitHub is happy with a unique user agent
    }
});

MyGitHubApi.prototype.login = function() {
    var user = localStorage.getItem('user');
    var token = localStorage.getItem('token');
    if (user != null && token != null)
        this.events.emit('authenticated', token);
    else {

        user = readlineSync.question('User :', {
        });

        var pwd = readlineSync.question('Password :', {
            hideEchoBack: true
        });

        github.authenticate({
            type:"basic",
            username:user,
            password:pwd
        });

        var twofa = readlineSync.question('2fa: ');
        github.authorization.create({
            scopes: ["public_repo", "repo"],
            note: appname,
            note_url: "http://url-to-this-auth-app",
            client_id: clientid,
            client_secret: clientsecret,
            fingerprint: appname,
            headers: {
                "X-GitHub-OTP": twofa
            }
        }, function(err, res) {
            //console.log(JSON.stringify(res));
            if (res != null && res.token) {
                localStorage.setItem('user', user);
                localStorage.setItem('token', res.token);
                github.authenticate({
                    type:"oauth",
                    token:res.token,
                });
                github.events.emit('authenticated', res.token);
            }
        });
    }
}

module.exports = github;