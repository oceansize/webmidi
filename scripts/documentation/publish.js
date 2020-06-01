const credentials = require("../../.credentials/ftp.json");
const FtpDeploy = require("ftp-deploy");
const ghpages = require("gh-pages");
const moment = require("moment");
const pkg = require("../../package.json");

// Commit message for gh-pages (e.g. 2020-05-10T13:05:01-04:00)
let message = "Updated on: " + moment().format();

// FTP configuration
let config = {
  user: credentials.user,
  host: credentials.host,
  password: credentials.password,
  port: 21,
  localRoot: __dirname + `/../../docs/`,
  include: [`v${pkg.version}/*`, `v${pkg.version}/**/*`],
  remoteRoot: "/",
  deleteRemote: false,
  forcePasv: true,
  secure: "control"
};

async function execute() {

  // Instantiate FTP object
  const ftp = new FtpDeploy();

  // Set up per-file completion listener
  ftp.on("uploaded", data => {
    console.info("\x1b[32m", `Uploaded: /docs/v${pkg.version}/${data.filename}`, "\x1b[0m");
  });

  // Set up per-file error listener
  ftp.on("upload-error", function(data) {
    console.info("\x1b[31m", "Error " + data.err, "\x1b[0m");
  });

  // Upload
  console.info("\x1b[32m", "Uploading files via FTP...", "\x1b[0m");
  await ftp.deploy(config);
  console.info("\x1b[32m", "Done.", "\x1b[0m");

  // Commit and push to GitHub pages
  console.info("\x1b[32m", "Pushing files to gh-pages...", "\x1b[0m");
  ghpages.publish("docs", {message: message}, err => {
    if (err) throw new Error(err);
    console.info("\x1b[32m", "Done.", "\x1b[0m");
  });

}

// Execute and catch errors if any (in red)
execute().catch(error => console.error("\x1b[31m", "Error: " + error.message, "\x1b[0m"));