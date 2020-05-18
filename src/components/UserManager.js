import {Log as oidclog, UserManager} from 'oidc-client';
import {KJUR} from 'jsrsasign';
import {BASE_URL} from "../shared/env";
import {reportToSentry} from "../shared/tools";
import api from '../shared/Api';

const AUTH_URL = 'https://accounts.kbb1.com/auth/realms/main';

oidclog.logger = console;
oidclog.level = 4;
let user_mgr = null;

const userManagerConfig = {
    authority: AUTH_URL,
    client_id: 'galaxy',
    redirect_uri: `${BASE_URL}`,
    response_type: 'token id_token',
    scope: 'profile',
    post_logout_redirect_uri: `${BASE_URL}`,
    automaticSilentRenew: true,
    silentRequestTimeout: 30000,
    silent_redirect_uri: `${BASE_URL}/silent_renew.html`,
    filterProtocolClaims: true,
    loadUserInfo: true,
};

export const client = new UserManager(userManagerConfig);

client.events.addAccessTokenExpiring(() => {
    console.log("...RENEW TOKEN...");
});

client.events.addAccessTokenExpired((data) => {
    console.log("...!TOKEN EXPIRED!...");
    reportToSentry("TOKEN EXPIRED: " + data,{source: "login"}, user_mgr, "warning");
    client.signoutRedirect();
});

client.events.addUserSignedOut(() => {
    console.log("...LOGOUT EVENT...");
    //client.signoutRedirect();
});

client.events.addSilentRenewError((error) =>{
    console.error("Silent Renew Error: " + error);
    reportToSentry("Silent Renew Error: " + error,{source: "login"}, user_mgr, "warning");
});

export const pendingApproval = (user) => user && !!user.roles.find(role => role === 'pending_approval');

export const buildUserObject = (oidcUser) => {
  if (!oidcUser) {
    return oidcUser;
  }
  const at = KJUR.jws.JWS.parse(oidcUser.access_token);
  const {
    realm_access: {roles},
    request,
    timestamp: request_timestamp,
    pending,
  } = at.payloadObj;
  const {
    email,
    given_name,
    group,
    name,
    sub,
    title,
  } = oidcUser.profile;
  const user = {
    access_token: oidcUser.access_token,
    email,
    group,
    id: sub,
    name,
    pending,
    request,
    request_timestamp,
    roles,
    title: title || given_name,
    username: given_name,
  };
  user.role = pendingApproval(user) ? 'ghost' : 'user';
  user_mgr = user;
  //console.log('USER getUser', oidcUser, at, user);
  return user;
}

// Runs cb on local user info.
export const getUser = (cb) => {
  return client.getUser().then((user) => {
    cb(buildUserObject(user));
  }).catch((error) => {
    console.log("Error: ",error);
    reportToSentry("Get User Error: " + error, {source: "login"}, null, "warning");
  });
};

// Fetch remote user info.
export const getUserRemote = (cb) => {
  // Due to difference in local and remote user structure we get local user info,
  // then remote user info and merge only few required fields.
  getUser((user) => {
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

export default client;
