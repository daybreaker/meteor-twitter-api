TwitterApi = function(options) {
  this._url = "https://api.twitter.com";
  this._version = "1.1";
  this.app_auth_token = "";
  if (options) _.extend(this, options);
};

TwitterApi.prototype = {

  _getUrl: function(url){
    return [this._url, this._version, url].join('/');
  },
  
  get: function(url, params){
    return this.call('GET',url,params);
  },
  
  post: function(url, params){
    return this.call('POST',url,params);
  },
  
  call: function(method, url, params){
    //this.unblock();
  
    oauthBinding = this.getOauthBindingForCurrentUser();
  
    result = oauthBinding.call(method,
      this._getUrl(url),
      params
    );
  
    return result;
  },
  
  callAsApp: function(method, url, params){
  
    this.createApplicationToken();
  
    result = Meteor.http.call(method,
      this._getUrl(url), {
      params : params,
      headers : {
        'Authorization': 'Bearer ' + this.app_auth_token
      }
    });
  
    return result;
  },
  
  getOauthBinding: function() {
    var config = Accounts.loginServiceConfiguration.findOne({service: 'twitter'});
  
    var urls = {
      requestToken: "https://api.twitter.com/oauth/request_token",
      authorize: "https://api.twitter.com/oauth/authorize",
      accessToken: "https://api.twitter.com/oauth/access_token",
      authenticate: "https://api.twitter.com/oauth/authenticate"
    };
  
    return new OAuth1Binding(config, urls);
  },
  
  getOauthBindingForCurrentUser: function(){
    var oauthBinding = this.getOauthBinding();
  
    var user = Meteor.user();
    oauthBinding.accessToken = user.services.twitter.accessToken;
    oauthBinding.accessTokenSecret = user.services.twitter.accessTokenSecret;
  
    return oauthBinding;
  },
  
  publicTimeline: function() {
    return this.get('statuses/sample.json');
  },
  
  userTimeline: function() {
    return this.get('statuses/user_timeline.json');
  },
  
  homeTimeline: function() {
    return this.get('statuses/home_timeline.json');
  },
  
  /* https://dev.twitter.com/docs/api/1.1/post/statuses/filter */
  filter: function(param_key, params) {

    var transitions = [25,24,21,20,19,16,14,12,10];
    var sizes = [20,18,16,14];
    var Fiber = Npm.require('fibers');

    var data = []
    if(param_key && params){
      data[param_key] = params;
    }
    stream = this.post("statuses/filter.json", this.normalizeParams(data));
    console.log stream
    
    return stream.on('data', function(data) {
      Fiber( function() {
        if (!!data.text && !!data.user.screen_name && Tweet.find().count() < 10) {
          var now = (new Date()).getTime();
          var randT = Math.floor(Math.random() * transitions.length);
          var randS = Math.floor(Math.random() * sizes.length);
          Tweets.insert({
            text: twittertext.autoLink(data.text),
            author: twittertext.autoLink('@' + data.user.screen_name),
            transition: transitions[randT],
            added: now,
            size: sizes[randS],
            x: 101,
            y: Math.floor(Math.random() * 90)
          });
        }
      }).run();
    };
  },
  
  normalizeParams: function (params) {
    var normalized = params
    if (params && typeof params === 'object') {
      Object.keys(params).forEach(function (key) {
        var value = params[key]
        // replace any arrays in `params` with comma-separated string
        if (Array.isArray(value))
          normalized[key] = value.join(',')
      })
    }
    return normalized
  },
  
  track: function(params) {
      return this.filter('track', params);
  },
  
  follow: function(params) {
      return this.filter('follow', params);
  },
  
  locations: function(params) {
      return this.filter('locations', params);
  },
  
  postTweet: function(text, reply_to){
    tweet = {
      status: text,
      in_reply_to_status_id: reply_to || null
    };
  
    return this.post('statuses/update.json', tweet);
  },
  
  follow: function(screenName){
    return this.post('friendships/create.json',{screen_name: screenName, follow: true});
  },
  
  getLists: function(user) {
    if (user) {
      return this.get("lists/list.json", {
        screen_name: user
      });
    } else {
      return this.get("lists/list.json");
    }
  },
  
  getListMembers: function(listId, cursor) {
    if (cursor === null) {
      cursor = "-1";
    }
    return this.get("lists/members.json", {
      list_id: listId,
      cursor: cursor
    });
  },
  
  usersSearch: function(query, page, count, includeEntities) {
    if (page === null) {
      page = 0;
    }
    if (count === null) {
      count = 10;
    }
    if (includeEntities === null) {
      includeEntities = true;
    }
    return this.get("users/search.json", {
      q: query,
      page: page,
      count: count,
      include_entities: includeEntities
    });
  },
  
  search: function (query) {
  
    return this.callAsApp('GET', 'search/tweets.json', {
      'q': query
    });
  },
  
  createApplicationToken: function() {
    var url = 'https://api.twitter.com/oauth2/token'
    var config = Accounts.loginServiceConfiguration.findOne({service: 'twitter'});
    var base64AuthToken = new Buffer(config.consumerKey + ":" + config.secret).toString('base64');
  
    var result = Meteor.http.post(url, {
      params: {
        'grant_type': 'client_credentials'
      },
      headers: {
        'Authorization': 'Basic ' + base64AuthToken,
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
      }
    });
    this.app_auth_token = result.data.access_token;
    return this.app_auth_token;
  }
}
