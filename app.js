// get needed node modules
// app_settings is a private module. Its a simple file that holds the necessary credentials for twitter and db
var APP_SETTINGS = require('app_settings');

var request = require('request');
var http = require('http');
var twit = require('twit');
var mongo = require('mongodb');

// set constants
var API_KEY = APP_SETTINGS.twitter.API_KEY;
var SHORT_URL_LEN = 20;

// Create Db connection
var Db = mongo.Db;
var server = mongo.Server;
var dbclient = new Db(APP_SETTINGS.db.name, new server(APP_SETTINGS.db.host,APP_SETTINGS.db.port,{}), {
    safe: true
});

// Define App namespace
var RD = {};

RD.channels = [
{	
    subreddit: 'java',
    url: 'http://www.reddit.com/r/java.json',
    twitter: APP_SETTINGS.twitter.javaaccount
	
},
{	
    subreddit: 'programming',
    url: 'http://www.reddit.com/r/programming.json',
    twitter: APP_SETTINGS.twitter.programmingaccount
	
}
];


// define needed functions

// tweet top posts
RD.tweetTopPosts = function (topPosts) {
    var tweet, t, originalLen, toSub;
    var tweetObj = {};

    // get the twitter credential
    for (channel in RD.channels) {
        for (posts in topPosts) {
            if (RD.channels[channel].subreddit === topPosts[posts].subreddit) {
                tweetObj[topPosts[posts].subreddit] = RD.channels[channel].twitter;
            }
        }
    }
	   
    
    dbclient.open(function(e,r){
        function inserter(i) {
            var originalLen, tweet, toRemove;
	
            if (i < topPosts.length) {
                originalLen = topPosts[i].title.length + SHORT_URL_LEN;
                if (originalLen >= 140) {
                    toRemove = originalLen - 140;
                    tweet = topPosts[i].title.substr(0,(topPosts[i].title.length - toRemove)) + ' ' + topPosts[i].url;	
                } else {
                    tweet = topPosts[i].title + ' ' + topPosts[i].url;
                }
	
                //see if you have space to add #java hashtag
                if ((140 - tweet.length && topPosts[i].subreddit === 'java') >= 6) {
                    tweet += ' #java';
                }
				
                dbclient.collection('tweeted', function(e,collection){
                    collection.find({
                        id:topPosts[i].id
                    }).toArray(function(err,res){
                        if (res.length === 0) { //tweet
						
                            if (topPosts[i].subreddit === 'java') {
                                return;
                            }
						
                            t = new twit(tweetObj[topPosts[i].subreddit]);
                            t.post('statuses/update', {
                                status: tweet
                            },function(e,r){
                                if(!e) {
                                    collection.insert({
                                        id:topPosts[i].id
                                    }, function(e,r){
                                        //log error somewhere
                                        });
                                }
                            });
			
			
                        } else {
                            console.log("Already tweeted. Logged on " + new Date().toString());
                        }
		
                    });
		
                    inserter(i + 1);
		
                });

            } 


        }


        // dbclient.collection('tweeted', function(e,collection){
        // collection.remove(function(e,r){
        // });
        // });


        inserter(0);
    //dbclient.close();
    });
};


// return top post that would be tweeted
RD.getTopPosts = function(posts) {
    var i = 0, post,
    iLen = posts.length,
    topPosts = [];

    for (i; i < iLen; i++) {
	
        if (posts[i].data.subreddit === 'java') {
		
            if ((posts[i].data.num_comments >= 2) && (posts[i].data.score >= 5 )) {
                // save ID
                // save title
                // save URL ie url to external article
                // save permalink to*/

                topPosts.push({
                    id : posts[i].data.id,
                    title : posts[i].data.title,
                    url : posts[i].data.url,
                    subreddit : posts[i].data.subreddit,
                    permalink : posts[i].data.permalink
                });
            }
        }
		
        if (posts[i].data.subreddit === 'programming') {
            if (posts[i].data.score >= 20 ) {
                // save ID
                // save title
                // save URL ie url to external article
                // save permalink to*/

                topPosts.push({
                    id : posts[i].data.id,
                    title : posts[i].data.title,
                    url : posts[i].data.url,
                    subreddit : posts[i].data.subreddit,
                    permalink : posts[i].data.permalink
                });
            }
		
        }

	
    }
    return topPosts;
};



// Fetch post from reddit
RD.fetch = function(channels) {
    var topPosts;
    for (i = 0, len = RD.channels.length; i < len; i++ ) {
		
        (function(i) {
            request(RD.channels[i].url, function(err,head,body){
                var response;
                // /*get the posts*/
                response = JSON.parse(body);
                topPosts = RD.getTopPosts(response.data.children);
                dbclient.close(); //work around until i get to find out why the multiple db open error occurs
                RD.tweetTopPosts(topPosts);
	
            });

        })(i);

		
		
    }

};

// Start and fetch every 30minutes
setInterval(function(){
    RD.fetch(RD.channels);    
}, 180000);