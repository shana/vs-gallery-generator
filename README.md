Generate a VS gallery atom feed from the releases of the VisualStudio github repo

To use this:

1. Create a personal token that can list releases and access repos
1. Create a folder called `scratch`
1. Create a file `user` in the `scratch` folder and put your username in there
1. Create a file `token` in the `scratch` folder and put the token in there
1. Create a new github app
1. Export the following environment variables to run:

  ```
APP_NAME="Your App Name"
APP_CLIENT_ID=[your app id]
APP_CLIENT_SECRET=[your app secret
  ```

7. Run `node index.js` to generate the feed. It will be generated into `files`


