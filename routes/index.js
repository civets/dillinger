var path = require('path')
  , request = require('request')
  , qs = require('querystring')
  , Dropbox = require( path.resolve(__dirname, '../plugins/dropbox/dropbox.js') ).Dropbox
  , Github = require( path.resolve(__dirname, '../plugins/github/github.js') ).Github
  , GoogleDrive = require('../plugins/googledrive/googledrive.js').GoogleDrive
  , OneDrive = require('../plugins/onedrive/onedrive.js').OneDrive
  , qiniu = require('qiniu')
  , _ = require('underscore')
  , config = require('node-configs')
  ;

// Show the home page
exports.index = function(req, res) {

  console.info(config.get('baseUrl'));

  // Some flags to be set for client-side logic.
  var indexConfig = {
    isDropboxAuth: !!req.session.isDropboxSynced,
    isGithubAuth: !!req.session.isGithubSynced,
    isEvernoteAuth: !!req.session.isEvernoteSynced,
    isGoogleDriveAuth: !!req.session.isGoogleDriveSynced,
    isOneDriveAuth: !!req.session.isOneDriveSynced,
    isDropboxConfigured: Dropbox.isConfigured,
    isGithubConfigured: Github.isConfigured,
    isGoogleDriveConfigured: GoogleDrive.isConfigured,
    isOneDriveConfigured: OneDrive.isConfigured
  }

  if (!req.session.isEvernoteSynced) {
    console.warn('Evernote not implemented yet.')
  }

  if (req.session.github && req.session.github.username) indexConfig.github_username = req.session.github.username

  // 获取七牛指定前缀的图片
  qiniu.conf.ACCESS_KEY = config.get('qiniu.access_key');
  qiniu.conf.SECRET_KEY = config.get('qiniu.secret_key');
  var client = new qiniu.rs.Client();

  var bucket = config.get('qiniu.bucket');
  var limit = config.get('qiniu.rs_list.limit');
  var prefix = config.get('qiniu.rs_list.prefix');
  var url = "http://rsf.qbox.me/list?bucket=" + bucket + "&prefix=" + prefix + "&limit=" + limit;

  request.post({
    url: url,
    headers: {
      'Content-type': 'application/x-www-form-urlencoded',
      'Authorization': qiniu.util.generateAccessToken(url)
    }
  }, function(e, rsp, data) {
    if(e) console.info(e);
    var items = JSON.parse(data).items;
    indexConfig.imgs = items;
    return res.render('index', indexConfig);
  });

}

// Show the not implemented yet page
exports.not_implemented = function(req, res) {
  res.render('not-implemented')
}

// Handle upload pictures
exports.upload = function(req, res) {

  qiniu.conf.ACCESS_KEY = config.get('qiniu.access_key');
  qiniu.conf.SECRET_KEY = config.get('qiniu.secret_key');

  //构建上传策略函数，设置回调的url以及需要回调给业务服务器的数据
  function uptoken(bucket, key) {
    var putPolicy = new qiniu.rs.PutPolicy(bucket + ":" + key);
    putPolicy.callbackUrl = config.get('baseUrl') + '/callback';
    putPolicy.callbackBody = 'filename=$(fname)&filesize=$(fsize)';
    return putPolicy.token();
  }

  //构造上传函数
  function uploadFile(uptoken, key, localFile) {
    var extra = new qiniu.io.PutExtra();
      qiniu.io.putFile(uptoken, key, localFile, extra, function(err, ret) {
        if(!err) {
          // 上传成功， 处理返回值
          console.log(ret.hash, ret.key, ret.persistentId);
        } else {
          // 上传失败， 处理返回代码
          console.log(err);
        }
    });
  }

  // 上传至七牛
  var bucket = config.get('qiniu.bucket');
  var uid = 'lsk';
  _.each(req.files, function(item) {
    // 建议使用用户标识的作为图片前缀
    var key = uid + ":" + item.name;
    var filePath = item.path;
    token = uptoken(bucket, key);
    uploadFile(token, key, filePath);
    console.log("filename: " + item.name + ", filesize: " + item.size);
  });
  res.render('test');
}

// 文件上传回调
exports.callback = function(req, res) {
  console.log(req);
  res.render('test');
}
