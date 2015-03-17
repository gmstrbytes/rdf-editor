'use strict';

angular.module('myApp.fileBrowser', ['ngRoute', 'ui.bootstrap'])

.config(['$routeProvider', function($routeProvider) {
  $routeProvider.when('/browser', {
    templateUrl: 'browser/browser.html',
    controller: 'FileBrowserCtrl'
  });
}])

.filter('ioTypeLabel', function() {
  return function(input) {
    switch(input) {
      case 'webdav':
        return 'WebDAV Folder';
      case 'ldp':
        return 'LDP Location';
      case 'sparql':
        return 'SPARQL Endpoint';
      default:
        return input;
    }
  };
})

.filter('httpStatusLabel', function() {
  return function(input) {
    switch(input) {
      case 0:
        return 'Connection Refused';
      case 404:
        return 'Not Found';
      case 401:
        return 'Authorization Required';
      case 403:
        return 'Access Denied';
      default:
        return input;
    }
  };
})

.controller('AuthInfoDialogCtrl', ["$scope", "$modalInstance", function($scope, $modalInstance) {
  $scope.username = "";
  $scope.password = "";

  $scope.ok = function() {
    $modalInstance.close({
      uid: $scope.username,
      pwd: $scope.password
    });
  };

  $scope.cancel = function() {
    $modalInstance.dismiss();
  };
}])

.controller('FileBrowserCtrl', ["$scope", "$modal", "Profile", function($scope, $modal, Profile) {

  /**
   * Our function which updates the storage locations from the profile.
   * This needs to be triggered whenever the profile information changes.
   */
  $scope.updateProfileStorageLocations = function(storages) {
    if(storages) {
      RDFE.Utils.resolveStorageLocations(storages, function(files) {
        // use Angular's apply to enforce the scope update after an async operation without user interaction
        $scope.$apply(function() {
          $.merge($scope.locations, files);
        });
      });
    }
  }

  function loadRecentDocs() {
    var r = new RDFE.IO.Folder();
    r.name = "Recent Documents";

    var recentDocs = $.jStorage.get('rdfe:recentDocuments');
    if(recentDocs) {
      for(var i = 0; i < recentDocs.length && i < 10; i++) {
        if(recentDocs[i]) {
          var d = new RDFE.IO.File(recentDocs[i].url);
          d.ioType = recentDocs[i].ioType;
          d.name = recentDocs[i].title || d.name;
          d.sparqlEndpoint = recentDocs[i].sparqlEndpoint;
          r.children.push(d);
        }
      }
    }

    return r;
  }

  /**
   * Authentication function which requests a username and pwd from the user
   * to provide to the @p success function. If the user canceles the @p fail
   * callback will be invoked instead.
   */
  function getAuthInfo(url, success, fail) {
    $modal.open({
      templateUrl: 'authInfoDialog.html',
      controller: 'AuthInfoDialogCtrl',
      resolve: {
        'url': function() {
          return url;
        }
      }
    }).result.then(function(result) {
      success(result.uid, result.pwd);
    }, function() {
      fail();
    });
  };

  // property to order files and folders by (fodlers are always first)
  $scope.orderProp = "name";

  // array of default locations
  $scope.locations = [
    loadRecentDocs()
  ];

  // browser state
  $scope.currentLocation = $scope.locations[0];
  $scope.currentFolder = $scope.currentLocation;


  Profile.profile(function(s, pd) {
    $scope.updateProfileStorageLocations(pd.storage);
  });

  $scope.setCurrentLocation = function(location) {
    if(location != $scope.currentLocation) {
      if(location.httpStatus) {
        RDFE.IO.openFolder(location.url, {
          authFunction: getAuthInfo
        }, function(dir) {
          // success, we found a container
          $scope.$apply(function() {
            // FIXME: make sure that the location is actually a folder. If not, do sth.
            // replace the old location with the new one
            $scope.locations[$scope.locations.indexOf(location)] = dir;
            $scope.currentLocation = $scope.currentFolder = dir;
          });
        }, function(errMsg, status) {
          // even if there is an error we change the current location
          // the ui will show the error automatically
          location.httpStatus = status;
          location.errorMessage = errMsg;
          $scope.$apply(function() {
            $scope.currentLocation = $scope.currentFolder = location;
          });
        });
      }
      else {
        $scope.currentLocation = $scope.currentFolder = location;
      }
    }
  };

  $scope.changeDir = function(folder) {
    folder.update(function() {
      $scope.$apply(function() {
        $scope.currentFolder = folder;
      });
    }, function() {
      // even if there is an error we change the current folder
      // the ui will show the error automatically
      $scope.currentFolder = folder;
    });
  };

  $scope.folderUp = function() {
    if($scope.currentFolder.parent) {
      $scope.currentFolder = $scope.currentFolder.parent;
    }
  };

  $scope.openFile = function(file) {
    window.location.href =
      window.location.protocol +
      '//' +
      window.location.host +
      window.location.pathname +
      '#/editor?uri=' + encodeURIComponent(file.url) +
      '&ioType=' + encodeURIComponent(file.ioType) +
      '&sparqlEndpoint=' + encodeURIComponent(file.sparqlEndpoint);
  };
}]);
