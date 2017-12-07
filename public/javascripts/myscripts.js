var app = angular.module('chatterBox', []);

app.controller('loginCtrl', function ($scope, $http) {

    $scope.login = function (user) {
        if (user.username == "" || user.password == "") {
            alert("You must enter username and password!");
            return;
        } else {
            $http.post("/login", user).then(function (response) {
                if (response.data.msg === "Login Failed") {
                    $scope.new_report.password = "";
                }
                else {
                    alert("Sussess" + response.data.msg);
                }
            }, function (response) {
                alert("Internal error!");
            });
        }
    }
});