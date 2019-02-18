var express = require('express');
var router = express.Router();
var session = require('express-session');
var bodyParser = require('body-parser');
var mongo = require('mongodb');

router.use(session({ secret: 'sqwang' }));
router.use(bodyParser.json());

var LOGIN_FAIL = "Login failure";
var USER_NOT_FOUND = "No such user";
var ALREADY_LOGGED_IN = "Already logged in";

/*
* GET session use userId
* if exists, return JSON
* else return empty
*/
router.get('/load', async function (req, res) {
    if (req.session.userId) {
        var userId = req.session.userId;
        var db = req.db;
        var userList = db.get('userList');
        var messageList = db.get('messageList');

        try {
            // Current user info
            var result = await userList.findOne({ "_id": userId }, {});

            if (result.length === 0) {
                res.send({ msg: LOGIN_FAIL });
            } else {
                var response = {
                    id: result._id,
                    name: result.name,
                    icon: result.icon,
                    friends: []
                };

                // get friend ids
                for (var i = 0; i < result.friends.length; i++) {
                    var friendInfo = await userList.findOne({ "name": result.friends[i].name }, {});
                    if (friendInfo.length === 0) {
                        res.send({ msg: USER_NOT_FOUND });
                    } else {
                        var friendId = friendInfo._id.toString();
                        var lastMsgId = result.friends[i].lastMsgId;

                        // number of unread messages
                        var messages = await messageList.find({ "senderId": friendId, "receiverId": userId }, {});
                        var newMsgNum = 0;
                        messages.forEach(message => {
                            if (message._id.toString() > lastMsgId) {
                                newMsgNum++;
                            }
                        });
                        response.friends.push({ id: friendId, name: friendInfo.name, lastMsgId: lastMsgId, newMsgNum: newMsgNum });
                    }
                }
                res.send(response);
            }
        } catch (err) {
            res.send({ msg: err });
        }

    } else {
        res.send({ msg: '' });
    }
});

/*
* POST login
* post username and password
*/
router.post('/login', function (req, res) {
    var userId = req.session.userId;
    if (userId) {
        res.send({ msg: ALREADY_LOGGED_IN });
    }
    var username = req.body.username;
    var password = req.body.password;
    // check input values
    if (!username || !password) {
        res.send({ msg: "Null or invalid inputs", "body": req.body });
    }

    var db = req.db;
    var collection = db.get('userList');

    collection.findOne({ "name": username, "password": password }, {}, function (err, result) {
        if (err === null) {
            if (result.length === 0) {
                res.send({ msg: LOGIN_FAIL });
            } else {
                userId = result._id;
                collection.update({ "_id": userId }, { $set: { "status": "online" } }, function (err, dump) {
                    if (err === null) {
                        req.session.userId = userId;
                        var response = {
                            id: result._id,
                            name: result.name,
                            icon: result.icon,
                            friends: []
                        };

                        result.friends.forEach(function (item) {
                            collection.findOne({ "name": item.name }, {}, function (err, friendInfo) {
                                if (err === null) {
                                    if (friendInfo.length === 0) {
                                        res.send({ msg: USER_NOT_FOUND });
                                    } else {
                                        response.friends.push({ id: friendInfo._id, name: friendInfo.name, lastMsgId: item.lastMsgId });
                                        if (response.friends.length === result.friends.length) {
                                            res.json(response);
                                        }
                                    }
                                } else {
                                    res.send({ msg: USER_NOT_FOUND });
                                }
                            });
                        });
                    } else {
                        res.send({ msg: err });
                    }
                });
            }
        } else {
            res.send({ msg: err });
        }
    });
});

/*
* GET logout
* update status
*/
router.get('/logout', function (req, res) {
    var userId = req.session.userId;
    req.session.userId = null;
    var db = req.db;
    var collection = db.get('userList');
    collection.update({ "_id": userId }, { $set: { "status": "offline" } }, function (err, result) {
        res.send(
            (err === null) ? { msg: '' } : { msg: err }
        );
    });
});

/*
* GET get user info
* 
*/
router.get('/getuserinfo', function (req, res) {
    var userId = req.session.userId;
    if (!userId) {
        res.send({ msg: "Please login" });
    }
    var db = req.db;
    var collection = db.get('userList');
    collection.findOne({ "_id": userId }, { fields: { "mobileNumber": 1, "homeNumber": 1, "address": 1 } }, function (err, result) {
        if (err === null) {
            if (result.length === 0) {
                res.send({ msg: "No such user" });
            } else {
                res.json(result);
            }
        } else {
            res.status(500);
            res.send({ msg: err });
        }
    });
});

/*
* PUT update user info
* 
*/
router.put('/saveuserinfo', function (req, res) {
    var mobileNumber = req.body.mobileNumber;
    var homeNumber = req.body.homeNumber;
    var address = req.body.address;
    var userId = req.session.userId;
    if (!userId) {
        res.send({ msg: "Please login" });
    }
    var db = req.db;
    var collection = db.get('userList');
    collection.update({ "_id": userId }, { $set: { "mobileNumber": mobileNumber, "homeNumber": homeNumber, "address": address } }, function (err, result) {
        res.send(
            (err === null) ? { msg: '' } : { msg: err }
        );
    });
});

/*
* GET get conversation
* 
*/
router.get('/getconversation/:friendid', async function (req, res) {
    var userId = req.session.userId;
    if (!userId) {
        res.send({ msg: "Please login" });
    }
    var db = req.db;
    var userList = db.get('userList');
    var friendId = req.params.friendid;

    try {
        var friend = await userList.findOne({ "_id": friendId }, { fields: { "name": 1, "icon": 1, "status": 1 } });

        if (!friend || friend.length === 0) {
            res.send({ msg: USER_NOT_FOUND });
        } else {
            var friendName = friend.name;
            var response = {
                icon: friend.icon,
                status: friend.status
            };

            // check friendship
            var isFriend = await userList.findOne({ "_id": userId, "friends": { $elemMatch: { "name": friendName } } }, {});

            if (isFriend.length === 0) {
                res.send({ msg: USER_NOT_FOUND });
            } else {

                // retrive message
                var messageList = db.get('messageList');
                var messages = await messageList.find({ $or: [{ "senderId": userId, "receiverId": friendId }, { "senderId": friendId, "receiverId": userId }] }, {});

                var newMsgId = 0;
                for (var i = messages.length - 1; i >= 0; i--) {
                    if (messages[i].senderId === friendId) {
                        newMsgId = messages[i]._id;
                        break;
                    }
                }
                await userList.update({ "_id": userId, "friends": { $elemMatch: { "name": friendName } } }, { $set: { "friends.$.lastMsgId": newMsgId } });

                response["messages"] = messages;
                res.json(response);
            }
        }
    } catch (err) {
        res.status(500);
        res.send({ msg: err });
    }
});

// post message
router.post('/postmessage/:friendid', function (req, res) {
    var userId = req.session.userId;
    if (!userId) {
        res.send({ msg: "Please login" });
    }

    var message = req.body.message;
    var friendid = req.params.friendid;
    var date = req.body.date;
    var time = req.body.time;


    var db = req.db;
    var collection = db.get('messageList');
    collection.insert(
        {
            "senderId": userId,
            "receiverId": friendid,
            "message": message,
            "date": date,
            "time": time
        },
        function (err, result) {
            if (err !== null) {
                res.status(500);
                res.send({ msg: err });
            } else {
                res.send({ msg: result._id });
            }
        }
    );
});

// deletemessage
router.delete('/deletemessage/:msgid', function (req, res) {
    var userId = req.session.userId;
    if (!userId) {
        res.send({ msg: "Please login" });
    }

    var msgid = req.params.msgid;

    var db = req.db;
    var collection = db.get('messageList');
    collection.remove({ "_id": msgid }, function (err, result) {
        res.send(
            (err === null) ? { msg: "" } : { msg: err }
        );
    });
});

// getnewmessages
router.get('/getnewmessages/:friendid', async function (req, res) {
    var userId = req.session.userId;
    if (!userId) {
        res.send({ msg: "Please login" });
    }

    var friendId = req.params.friendid;

    var db = req.db;
    var userList = db.get('userList');
    var messageList = db.get('messageList');

    try {
        var friend = await userList.findOne({ "_id": friendId }, { fields: { "name": 1 } });
        if (!friend || friend.length === 0) {
            res.send({ msg: USER_NOT_FOUND });
        } else {
            var friendName = friend.name;

            var user = await userList.findOne({ "_id": userId, "friends": { $elemMatch: { "name": friendName } } }, { "friends": { $elemMatch: { "name": friendName } } });
            if (!user || user.length === 0) {
                res.send({ msg: USER_NOT_FOUND });
            } else {
                var lastMsgId = user.friends[0].lastMsgId;

                var messages = await messageList.find({ "senderId": friendId, "receiverId": userId });
                if (!messages || messages.length === 0) {
                    res.send({ msg: "" });
                } else {
                    newMsgId = messages[messages.length - 1]._id;
                    console.log(newMsgId);
                    await userList.update({ "_id": userId, "friends": { $elemMatch: { "name": friendName } } }, { $set: { "friends.$.lastMsgId": newMsgId } });
                    var response = [];
                    messages.forEach(message => {
                        if (message._id.toString() > lastMsgId) {
                            console.log(message._id)
                            response.push(message);
                        }
                    });
                    res.json(response);
                }
            }
        }
    } catch (err) {
        res.status(500);
        res.send({ msg: err });
    }
});

// get newmsgnum
router.get('/getnewmsgnum/:friendid', function (req, res) {
    var userId = req.session.userId;
    if (!userId) {
        res.send({ msg: "Please login" });
    }

    var friendid = req.params.friendid;

    var db = req.db;
    var userList = db.get('userList');
    var messageList = db.get('messageList');
    userList.findOne({ "_id": friendid }, { fields: { "name": 1 } }, function (err, result) {
        if (err === null) {
            if (result === null || typeof result === undefined || result.length === 0) {
                res.send({ msg: "No such user 1" });
            } else {
                var friendName = result.name;

                userList.findOne({ "_id": userId, "friends": { $elemMatch: { "name": friendName } } }, { "friends": { $elemMatch: { "name": friendName } } }, function (err, result) {
                    if (err === null) {
                        if (!result || result.length === 0) {
                            res.send({ msg: "No such user 2" });
                        } else {
                            var lastMsgId = result.friends[0].lastMsgId;

                            messageList.find({ "senderId": friendid, "receiverId": userId }, function (err, messages) {
                                if (err === null) {
                                    var newMsgNum = 0;
                                    for (var i = 0; i < messages.length; i++) {
                                        if (messages[i]._id.toString() > lastMsgId) {
                                            newMsgNum++;
                                        }
                                    }
                                    res.send({ msg: newMsgNum })
                                }
                            });
                        }
                    } else {
                        res.send({ msg: err });
                    }
                });
            }
        } else {
            res.send({ msg: err });
        }
    });
});

module.exports = router;
