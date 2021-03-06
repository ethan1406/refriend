// config/passport.js

// load all the things we need
var FacebookStrategy = require('passport-facebook').Strategy;

// load up the user model
var User       = require('../models/user');

// load the auth variables
var configAuth = require('./auth');

module.exports = function(passport) {

    // used to serialize the user for the session
    passport.serializeUser(function(user, done) {
        done(null, user.id);
    });

    // used to deserialize the user
    passport.deserializeUser(function(id, done) {
        User.findById(id, function(err, user) {
            done(err, user);
        });
    });
    
    // code for login (use('local-login', new LocalStategy))
    // code for signup (use('local-signup', new LocalStategy))

    // =========================================================================
    // FACEBOOK ================================================================
    // =========================================================================
    passport.use(new FacebookStrategy({

        // pull in our app id and secret from our auth.js file
        clientID        : configAuth.facebookAuth.clientID,
        clientSecret    : configAuth.facebookAuth.clientSecret,
        callbackURL     : configAuth.facebookAuth.callbackURL,
        profileFields: ['id', 'email', 'name', 'picture','friends'],


    },

    // facebook will send back the token and profile
    function(token, refreshToken, profile, done) {

        //asynchronous
        process.nextTick(function() {
            
           //console.log(profile._json.friends);
            // find the user in the database based on their facebook id
            User.findOne({ 'facebook.id' : profile.id }, function(err, user) {

                // if there is an error, stop everything and return that
                // ie an error connecting to the database
                if (err)
                    return done(err);

                // if the user is found, then log them in
                if (user) {
                    return done(null, user); // user found, return that user

                    //return done(null, false, { message: 'testing.' });
                } else {
                    // if there is no user found with that facebook id, create them
                    var newUser = new User();

                    // set all of the facebook information in our user model
                    newUser.facebook.id    = profile.id; // set the users facebook id                   
                    newUser.facebook.token = token; // we will save the token that facebook provides to the user                    
                    newUser.facebook.name  = profile.name.givenName + ' ' + profile.name.familyName; // look at the passport user profile to see how names are returned
                    if(profile.emails !== undefined)
                    newUser.facebook.email = profile.emails[0].value; // facebook can return multiple emails so we'll take the first
                    newUser.facebook.dpUrl = profile._json.picture.data.url;


                    var promises = [];
                    var friends =  profile._json.friends.data.map((friend) =>{

                            var friendWithRelations = friend;

                            
                            friendWithRelations.updateFriendship = 'default';
                            friendWithRelations['currentFriendship'] = 'default';


                             //checking if friends are already using the app and if so, add the user to their friend list
                            
                                promises.push( new Promise((resolve, reject) =>{
                                User.findOne({'facebook.id' : friend.id}, (err, existedUser) => {
                               
                                    if(err){
                                        console.log('error in passport.js finding for users friends');
                                        reject(err);
                                        
                                    }
                                    if(existedUser){
                                      
                                        var alreadyExisted = existedUser.friends.filter(friend => {
                                            return friend.id === profile.id;
                                        });
                                        if( alreadyExisted.length === 0){
                                            var friendObject = {};
                                            friendObject['name'] = newUser.facebook.name;
                                            friendObject['id'] = newUser.facebook.id;
                                            friendObject['dpUrl'] = newUser.facebook.dpUrl;
                                            friendObject['currentFriendship'] = 'default';
                                            friendObject['updateFriendship'] = 'default';
                                            existedUser.friends.push(friendObject);
                                            
                                            existedUser.save((err, updatedExistedUser) => {
                                                if(err){
                                                    console.err(err);
                                                }
                                            });
                                        }
                                       

                                        //assigning dpUrl to the user
                                        friendWithRelations.dpUrl = existedUser.facebook.dpUrl;
                                    } else{
                                        //testing purposes
                                        friendWithRelations['dpUrl'] = 'testing';
                                    }
                                    resolve();
                              
                                  });
                                })
                                );

                            return friendWithRelations;

                        });


                    Promise.all(promises)
                    .then(function() {
                         newUser.friends = friends;
                         // save our user to the database
                        newUser.save(function(err) {
                            if (err)
                                throw err;

                            // if successful, return the new user
                            return done(null, newUser);

                        });

                    })
                    .catch(reason => {console.log('promise error + ' + reason);});
                   



                   
                }

            });
        });

    }));

};


