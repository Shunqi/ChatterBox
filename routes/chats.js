var express = require('express');
var router = express.Router();
var session = require('express-session');
var bodyParser = require('body-parser');
var mongo = require('mongodb');

router.use(session({ secret: 'sqwang' }));
router.use(bodyParser.json());

var LOGIN_FAIL = "Login failure";
var USER_NOT_FOUND = "No such user";

/*
* GET session use userId
* if exists, return JSON
* else return empty
*/
router.get('/load', function (req, res) {
    if (req.session.userId) {
        var userId = req.session.userId;
        var db = req.db;
        var userList = db.get('userList');
        var messageList = db.get('messageList');
        userList.findOne({ "_id": userId }, {}, function (err, result) {
            if (err === null) {
                if (result.length === 0) {
                    res.send({ msg: LOGIN_FAIL });
                } else {
                    var response = {
                        name: result.name,
                        icon: result.icon,
                        friends: []
                    };

                    result.friends.forEach(function (item) {
                        userList.findOne({ "name": item.name }, {}, function (err, friendInfo) {
                            if (err === null) {
                                if (friendInfo.length === 0) {
                                    console.log("first");
                                    res.send({ msg: USER_NOT_FOUND });
                                } else {
                                    var friendId = friendInfo._id;
                                    var lastMsgId = item.lastMsgId;
                                    console.log(item);
                                    console.log(lastMsgId);
                                    // response.friends.push({ id: friendInfo._id, name: friendInfo.name, lastMsgId: item.lastMsgId });
                                    
                                    // if (response.friends.length === result.friends.length) {
                                    //     res.json(response);
                                    // }

                                    messageList.find({ "senderId": friendId, "receiverId": userId }, function (err, messages) {
                                        if (err === null) {
                                            console.log(friendId);
                                            console.log(userId);
                                            console.log(messages);
                                            console.log("db.messageList.find({ \"senderId\": \"" + friendId + "\", \"receiverId\": \"" + userId + "\"})");
                                            if (messages === null || typeof messages === undefined) {
                                                res.send({ msg: "" });
                                            } else {
                                                var newMsgNum = 0;
                                                for (var i = 0; i < messages.length; i++) {
                                                    console.log(messages[i]._id);
                                                    if (messages[i]._id > lastMsgId) {
                                                        newMsgNum++;
                                                    }
                                                }
                                                response.friends.push({ id: friendInfo._id, name: friendInfo.name, newMsgNum: newMsgNum });

                                                if (response.friends.length === result.friends.length) {
                                                    res.json(response);
                                                }
                                            }
                                        }
                                    });
                                }
                            } else {
                                res.send({ msg: err });
                            }
                        });
                    });
                }
            } else {
                res.send({ msg: err });
            }
        });
    } else {
        res.send({ msg: '' });
    }
});

/*
* POST login
* 
*/
router.post('/login', function (req, res) {
    // TODO
    // check already login


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
                req.session.userId = result._id;
                var response = {
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
                                    res.send(response);
                                }
                            }
                        } else {
                            res.send({ msg: USER_NOT_FOUND });
                        }
                    });
                });
            }
        } else {
            res.send({ msg: LOGIN_FAIL });
        }
    });
});

/*
* GET logout
* 
*/
router.get('/logout', function (req, res) {
    req.session.userId = null;
    res.send({ msg: "" });
});

/*
* GET get user info
* Task 1-4
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
            res.send({ msg: "db error" + err });
        }
    });
});

/*
* PUT update user info
* Task 1-5
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
* Task 1-6
*/
router.get('/getconversation/:friendid', function (req, res) {
    var userId = req.session.userId;
    if (!userId) {
        res.send({ msg: "Please login" });
    }
    var db = req.db;
    var collectionUserList = db.get('userList');
    var friendid = req.params.friendid;
    collectionUserList.findOne({ "_id": friendid }, { fields: { "name": 1, "icon": 1, "status": 1 } }, function (err, result) {
        if (err === null) {
            if (!result || result.length === 0) {
                res.send({ msg: "No such user" });
            } else {
                var friendName = result.name;
                console.log(friendName);
                var response = {
                    icon: result.icon,
                    status: result.icon
                };

                // check friendship
                collectionUserList.findOne({ "_id": userId, "friends": { $elemMatch: { "name": friendName } } }, {}, function (err, result) {
                    if (err === null) {
                        if (result.length === 0) {
                            res.send({ msg: "No such user" });
                        } else {
                            // retrive message
                            var collectionMessageList = db.get('messageList');
                            console.log(userId + friendid);
                            collectionMessageList.find({ $or: [{ "senderId": userId, "receiverId": friendid }, { "senderId": friendid, "receiverId": userId }] }, function (err, result) {
                                if (err === null) {
                                    response["messages"] = result;
                                    res.json(response);
                                } else {
                                    res.send({ msg: "db error" + err });
                                }
                            });
                        }
                    } else {
                        res.send({ msg: "db error" + err });
                    }
                });
            }
        } else {
            res.send({ msg: "db error" + err });
        }
    });
});

// Task 1-7
// postmessage
router.post('/postmessage/:friendid', function (req, res) {
    var userId = req.session.userId;
    if (!userId) {
        res.send({ msg: "Please login" });
    }

    var message = req.body.message;
    var date = req.body.date;
    var time = req.body.time;
    var friendid = req.params.friendid;

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
            res.send(
                (err === null) ? { msg: result._id } : { msg: err }
            );
        }
    );
});

// Task 1-8
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


// Task 1-9
// getnewmessages
router.get('/getnewmessages/:friendid', function (req, res) {
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
            if (!result || result.length === 0) {
                res.send({ msg: "No such user" });
            } else {
                var friendName = result.name;

                userList.findOne({ "_id": userId, "friends": { $elemMatch: { "name": friendName } } }, { "friends": { $elemMatch: { "name": friendName } } }, function (err, result) {
                    if (err === null) {
                        if (!result || result.length === 0) {
                            res.send({ msg: "No such user" });
                        } else {
                            var lastMsgId = result.friends[0].lastMsgId;

                            messageList.find({ "senderId": friendid, "receiverId": userId }, { "_id": { $gt: lastMsgId } }, function (err, result) {
                                if (err === null) {
                                    if (!result || result.length === 0) {
                                        res.send({ msg: "" });
                                    } else {
                                        res.json(result);
                                    }
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


// Task 1-10
// getnewmsgnum
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
                            console.log(lastMsgId);

                            messageList.find({ "senderId": friendid, "receiverId": userId }, function (err, messages) {
                                if (err === null) {
                                    console.log(friendid);
                                    console.log(userId);
                                    console.log(messages);
                                    console.log("messageList.find({ \"senderId\": " + friendid + ", \"receiverId\": " + userId + "})");
                                    if (messages === null || typeof messages === "undefined") {
                                        res.send({ msg: "" });
                                    } else {
                                        var newMsgNum = 0;
                                        for (var i = 0; i < messages.length; i++) {
                                            console.log(messages[i]._id);
                                            if (messages[i]._id > lastMsgId) {
                                                newMsgNum++;
                                            }
                                        }
                                        res.send({ msg: newMsgNum });
                                    }
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

// test connection, show all db data
router.get('/test', function (req, res) {
    var db = req.db;
    var collection = db.get('userList');
    collection.find({}, {}, function (err, result) {
        if (err === null)
            res.json(result);
        else res.send({ msg: err });
    });
});


module.exports = router;
