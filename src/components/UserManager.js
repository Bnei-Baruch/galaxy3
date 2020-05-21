import Keycloak from 'keycloak-js';
import {reportToSentry} from "../shared/tools";
import api from '../shared/Api';

const userManagerConfig = {
    url: 'https://accounts.kbb1.com/auth',
    realm: 'main',
    clientId: 'galaxy',
    enableLogging: true,
}

export const kc = new Keycloak(userManagerConfig);
console.log(kc)

kc.onTokenExpired = () => {
    console.log('Token Expired');
    kc.updateToken(70)
        .then((refreshed) => {
            if (refreshed) {
                console.log(kc)
                api.setAccessToken(kc.token);
            } else {
                api.setAccessToken(null);
                kc.logout()
            }
        })
        .catch((err) => console.log(err));
};

export const getUser = (callback) => {
    kc.init({onLoad: 'check-sso', checkLoginIframe: false})
        .then((authenticated) => {
            if (authenticated) {
                const {realm_access: {roles}, request, timestamp: request_timestamp, pending,email, given_name, group, name, sub, title} = kc.tokenParsed;
                const user = {email, group, id: sub, name, pending, request, request_timestamp, roles, title: title || given_name, username: given_name};
                //const {sub,given_name,name,email,group,title} = user.profile;
                api.setAccessToken(kc.token);
                callback(user, kc.token)
            } else {
                callback(null)
            }
        })
        .catch((err) => console.log(err));
};


// export const buildUserObject = (oidcUser) => {
//   if (!oidcUser) {
//     return {user: oidcUser};
//   }
//   console.log(oidcUser)
//   const at = KJUR.jws.JWS.parse(oidcUser.access_token);
//   console.log(at)
//   const {realm_access: {roles}, request, timestamp: request_timestamp, pending,email, given_name, group, name, sub, title} = at.payloadObj;
//   //const {email, given_name, group, name, sub, title,} = oidcUser.profile;
//   const user = {email, group, id: sub, name, pending, request, request_timestamp, roles, title: title || given_name, username: given_name,};
//   user.role = pendingApproval(user) ? 'ghost' : 'user';
//   user_mgr = user;
//   return {user, access_token: oidcUser.access_token};
// }
//
// // Runs cb on local user info.
// export const getUser = (cb) => {
//   return client.getUser().then((user) => {
//     cb(buildUserObject(user));
//   }).catch((error) => {
//     console.log("Error: ",error);
//     reportToSentry("Get User Error: " + error, {source: "login"}, null, "warning");
//   });
// };
//


// Fetch remote user info.
export const getUserRemote = (cb) => {
  // Due to difference in local and remote user structure we get local user info,
  // then remote user info and merge only few required fields.
  getUser(({user}) => {
    api.fetchUserInfo().then((remoteUser) => {
      //console.log('USER getUserRemote', remoteUser);
      const updatedUser = Object.assign({}, user);  // Shallow copy.
      updatedUser.request = remoteUser.attributes && remoteUser.attributes.request || undefined;
      updatedUser.request_timestamp = remoteUser.attributes && remoteUser.attributes.timestamp || undefined;
      updatedUser.pending = remoteUser.attributes && remoteUser.attributes.pending || undefined;
      console.log('USER getUserRemote', updatedUser);
      cb(updatedUser);
    }).catch((error) => {
      console.log("Error: ",error);
      reportToSentry("fetch user info Error: " + error, {source: "getUserRemote"}, null, "warning");
    });
  });
};

export default kc;
