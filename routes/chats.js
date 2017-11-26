var express = require('express');
var router = express.Router();
var session = require('express-session');
var bodyParser = require('body-parser');
var mongo = require('mongodb');

router.use(session({ secret: 'sqwang' }));
router.use(bodyParser.json());

/*
* GET session use userId
* if exists, return JSON
* else return empty
*/
router.get('/load', function (req, res) {
    if (req.session.userId) {
        var db = req.db;
        var collection = db.get('userList');
        collection.find({ "_id": req.session.userId }, {}, function (err, docs) {
            if (err === null)
                res.json(docs);
            else res.send({ msg: err });
        });
    } else {
        res.send({ msg: 'no userId in session' });
    }
});


/*
* POST login
* 
*/
router.post('/login', function (req, res) {
    var username = req.body.username;
    var password = req.body.password;
    // check input values
    if (!username || !password) {
        res.send({ msg: "Null or invalid inputs", "body": req.body });
    }
    var db = req.db;
    var collection = db.get('userList');
    collection.findOne({ "name": username, "password": password }, { fields: { "_id": 1, "name": 1 } }, function (err, docs) {
        if (err === null) {
            if (docs.length === 0) {
                res.send({ msg: "Login Failed", "username": username, "password": password });
            } else {
                req.session.userId = docs._id;
                res.send({ msg: docs.name + " " + docs._id, "docs": docs });
            }
        } else {
            res.send({ msg: "db error" + err });
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
* 
*/
router.get('/getuserinfo', function (req, res) {
    var userId = req.session.userId;
    if (!userId) {
        res.send({ msg: "Please login" });
    }
    var db = req.db;
    var collection = db.get('userList');
    collection.findOne({ "_id": userId }, { fields: { "mobileNumber": 1, "homeNumber": 1, "address": 1 } }, function (err, docs) {
        if (err === null) {
            if (docs.length === 0) {
                res.send({ msg: "No such user" });
            } else {
                res.json(docs);
            }
        } else {
            res.send({ msg: "db error" + err });
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
router.get('/getconversation/:friendid', function (req, res) {
    var userId = req.session.userId;
    if (!userId) {
        res.send({ msg: "Please login" });
    }
    var db = req.db;
    var collectionUserList = db.get('userList');
    var friendid = req.params.friendid;
    collectionUserList.findOne({ "_id": friendid }, { fields: { "name": 1, "icon": 1, "status": 1 } }, function (err, docs) {
        if (err === null) {
            if (!docs || docs.length === 0) {
                res.send({ msg: "No such user" });
            } else {
                var friendName = docs.name;
                console.log(friendName);
                response = {
                    icon: docs.icon,
                    status: docs.icon
                };


                // check friendship
                collectionUserList.findOne({ "_id": userId, "friends": { $elemMatch: { "name": friendName } } }, {}, function (err, docs) {
                    if (err === null) {
                        if (docs.length === 0) {
                            res.send({ msg: "No such user" });
                        } else {
                            // retrive message
                            var collectionMessageList = db.get('messageList');
                            console.log(userId + friendid);
                            collectionMessageList.find({ $or: [{ "senderId": userId, "receiverId": friendid }, { "senderId": friendid, "receiverId": userId }] }, function (err, docs) {
                                if (err === null) {
                                    response["messages"] = docs;
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

// test connection, show all db data
router.get('/test', function (req, res) {
    var db = req.db;
    var collection = db.get('userList');
    collection.find({}, {}, function (err, docs) {
        if (err === null)
            res.json(docs);
        else res.send({ msg: err });
    });
});


module.exports = router;
