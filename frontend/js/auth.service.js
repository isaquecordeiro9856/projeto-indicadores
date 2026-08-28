angular.module('DashboardApp').factory('AuthService', function($http) {
  var API_URL = '/api/auth';

  return {
    login: function(nm_usuario, ds_senha) {
      return $http.post(API_URL + '/login', {
        nm_usuario: nm_usuario,
        ds_senha: ds_senha
      }).then(function(response) {
        localStorage.setItem('tasy_token', response.data.token);
        localStorage.setItem('tasy_usuario', JSON.stringify(response.data.usuario));
        localStorage.setItem('tasy_perfil', JSON.stringify(response.data.perfil));
        return response.data;
      });
    },

    logout: function() {
      localStorage.removeItem('tasy_token');
      localStorage.removeItem('tasy_usuario');
      localStorage.removeItem('tasy_perfil');
      window.location.href = 'login.html';
    },

    getToken: function() {
      return localStorage.getItem('tasy_token');
    },

    getUsuario: function() {
      var u = localStorage.getItem('tasy_usuario');
      return u ? JSON.parse(u) : null;
    },

    getPerfil: function() {
      var p = localStorage.getItem('tasy_perfil');
      return p ? JSON.parse(p) : null;
    },

    isLoggedIn: function() {
      return !!this.getToken();
    },

    checkAuth: function() {
      if (!this.isLoggedIn()) {
        window.location.href = 'login.html';
        return false;
      }
      return true;
    }
  };
});
