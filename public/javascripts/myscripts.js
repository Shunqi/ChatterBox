var app = angular.module('chatterBox', ['ui.router']);

// global variables
var LOGIN_FAIL = "Login failure";
var USER_NOT_FOUND = "No such user";
var DEFAULT_MESSAGE = "Type a message here";
var INTERNAL_ERROR = "Internal error!"
var ALREADY_LOGGED_IN = "Already logged in";
var DB_ERROR = "500";
var EMPTY = "";
var userId = "";
var currentFriendId = "";
var friends = [];

// set routes
app.config(['$stateProvider', '$urlRouterProvider', function ($stateProvider, $urlRouterProvider) {
    $urlRouterProvider.otherwise('/home');

    $stateProvider
        .state('login', {
            url: '/login',
            templateUrl: 'login.html',
            controller: 'loginCtrl'
        })
        .state('home', {
            url: '/home',
            templateUrl: 'home.html',
            controller: 'homeCtrl'
        });
}]);

app.config(['$qProvider', function ($qProvider) {
    $qProvider.errorOnUnhandledRejections(false);
}]);

app.controller('loginCtrl', function ($scope, $http, $stateParams, $state) {

    $scope.login = function (user) {
        if (user.username == "" || user.password == "") {
            alert("You must enter username and password!");
            return;
        } else {
            $http.post("/login", user).then(function (response) {
                if (response.data.msg === LOGIN_FAIL) {
                    $scope.new_report.password = "";
                } else if (response.data.msg === ALREADY_LOGGED_IN) {
                    $state.transitionTo('home');
                }
                else {
                    userId = response.data.id;
                    $state.transitionTo('home');
                }
            }, function (response) {
                alert(INTERNAL_ERROR);
            });
        }
    }
});


app.controller('homeCtrl', function ($scope, $http, $stateParams, $state, $interval) {
    $scope.showUserInfo = false;
    $scope.showChat = false;
    var getNewMsg;

    // build the landing page
    $http.get("/load").then(function (response) {
        if (response.data.msg === EMPTY) {
            alert("Please login");
            $state.transitionTo('login');
        }
        else {
            $scope.username = response.data.name;
            $scope.userIcon = response.data.icon;
            $scope.userId = response.data.id;
            friends = response.data.friends;
            friends.forEach(friend => {
                newMsgNum = friend.newMsgNum;
                friend.newMsgNum = (newMsgNum === 0) ? "" : "(" + newMsgNum + ")";
            });
            $scope.friends = friends;
        }
    }, function (response) {
        alert(INTERNAL_ERROR);
    });

    // logout
    $scope.logout = function () {
        $http.get("/logout").then(async function (response) {
            if (response.data.msg === EMPTY) {
                userId = "";
                $state.transitionTo('login');
                await $scope.stopGetNewMsgNum();
                await $scope.stopGetNewMsg();
            }
            else {
                alert(INTERNAL_ERROR);
            }
        }, function (response) {
            alert(INTERNAL_ERROR);
        });
    }

    // display user information
    $scope.displayUserInfo = function () {
        $http.get("/getuserinfo").then(async function (response) {
            if (response.status === DB_ERROR) {
                alert("Internal error: " + response.data.msg);
            }
            else {
                $scope.showUserInfo = true;
                $scope.showChat = false;

                // stop receiving new messages
                await $scope.stopGetNewMsg();

                $scope.user = {
                    mobileNumber: response.data.mobileNumber,
                    homeNumber: response.data.homeNumber,
                    address: response.data.address
                };
            }
        }, function (response) {
            alert(INTERNAL_ERROR);
        });
    }

    // update user info
    $scope.saveUserInfo = function (user) {
        $http.put("/saveuserinfo", user).then(function (response) {
            if (response.data.msg !== "") {
                alert(response.data.msg);
            }
            else {
                alert("Successfully Updated!");
            }
        }, function (response) {
            alert(INTERNAL_ERROR);
        });
    }

    // enter chat room
    $scope.chat = function (friendId, friendName) {
        $http.get("/getconversation/" + friendId).then(async function (response) {
            if (response.status === DB_ERROR) {
                alert("Internal error: " + response.data.msg);
            } else if (response.data.msg === USER_NOT_FOUND) {
                alert(USER_NOT_FOUND);
            } else {
                // change view
                $scope.showUserInfo = false;
                $scope.showChat = true;

                //remove alarm
                for (var i = 0; i < friends.length; i++) {
                    if (friends[i].id === friendId) {
                        friends[i].newMsgNum = "";
                        break;
                    }
                }

                // update info
                $scope.friends = friends;
                $scope.friendIcon = response.data.icon;
                $scope.friendStatus = response.data.status;
                $scope.friendName = friendName;
                $scope.friendId = friendId;
                $scope.messages = response.data.messages;

                //default text value
                $scope.messageToSend = DEFAULT_MESSAGE;

                // stop periodical updates
                await $scope.stopGetNewMsg();

                // start new periodical updates 
                getNewMsg = $interval(function () {
                    console.log($scope.friendId);
                    $http.get("/getnewmessages/" + $scope.friendId).then(function (response) {
                        if (response.status === DB_ERROR) {
                            alert(INTERNAL_ERROR);
                        } else if (response.data.msg === USER_NOT_FOUND) {
                            alert(USER_NOT_FOUND);
                        } else if (response.data.msg === "") {

                        } else {
                            console.log(response.data);
                            response.data.forEach(message => {
                                $scope.messages.push({
                                    _id: message._id,
                                    senderId: message.senderId,
                                    receiverId: message.receiverId,
                                    message: message.message,
                                    date: message.date,
                                    time: message.time
                                });
                            });
                        }
                    }, function (err) {
                        alert(INTERNAL_ERROR);
                    });
                }, 1000);
            }
        }), function (response) {
            alert(INTERNAL_ERROR);
        };
    }


    $scope.stopGetNewMsg = function () {
        if (angular.isDefined(getNewMsg)) {
            $interval.cancel(getNewMsg);
            getNewMsg = undefined;
        }
    };

    $scope.stopGetNewMsgNum = function () {
        if (angular.isDefined(getNewMsgNum)) {
            $interval.cancel(getNewMsgNum);
            getNewMsg = undefined;
        }
    };

    // delete message
    $scope.delete = function (messageId) {
        $http.delete("/deletemessage/" + messageId).then(function (response) {
            if (response.data.msg !== "") {
                alert("Internal error: " + response.data.msg);
            } else {
                angular.element(document.getElementById(messageId)).remove();
                for (var i = 0; i < $scope.messages.length; i++) {
                    if ($scope.messages[i]._id === messageId) {
                        $scope.messages.splice(i, 1);
                        console.log($scope.messages);
                    }
                }
            }
        }, function (response) {
            alert(INTERNAL_ERROR);
        });
    }

    // send messages
    $scope.sendMessage = function ($event, friendId, friendName, messageToSend) {
        if ($event.keyCode == 13) {
            var dateTime = new Date().toString();
            var date = dateTime.substring(4, 15);
            var time = dateTime.substring(16, 24);
            var payload = { message: messageToSend, date: date, time: time };
            $http.post("/postmessage/" + friendId, payload).then(function (response) {
                if (response.status === DB_ERROR) {
                    alert("Internal error: " + response.data.msg);
                } else {
                    $scope.messages.push({
                        _id: response.data.msg,
                        senderId: userId,
                        receiverId: friendId,
                        message: messageToSend,
                        date: date,
                        time: time
                    });
                    $scope.chat(friendId, friendName);

                    $scope.messageToSend = DEFAULT_MESSAGE;
                }
            }, function (response) {
                alert(INTERNAL_ERROR);
            });
        }
    };

    getNewMsgNum = $interval(function () {
        friends.forEach(friend => {
            $http.get("/getnewmsgnum/" + friend.id).then(function (response) {
                if (response.data.msg === EMPTY) {
                    alert(INTERNAL_ERROR);
                } else {
                    newMsgNum = response.data.msg;
                    friend.newMsgNum = (newMsgNum === 0) ? "" : "(" + newMsgNum + ")";
                }
            }, function (response) {
                alert(INTERNAL_ERROR);
            });
        });
        $scope.friends = friends;
    }, 1000);

    // stop periodical operations
    $scope.$on("$destroy", async function () {
        await $scope.stopGetNewMsg();
        await $scope.stopGetNewMsgNum();
    });
});

// self define ngConfirmClick event
app.directive('ngConfirmClick', [
    function () {
        return {
            link: function (scope, element, attr) {
                var msg = attr.ngConfirmClick;
                var clickAction = attr.confirmedClick;
                element.bind('click', function (event) {
                    if (window.confirm(msg)) {
                        scope.$eval(clickAction)
                    }
                });
            }
        };
    }]);
