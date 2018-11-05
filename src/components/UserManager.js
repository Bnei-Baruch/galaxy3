import { Log as oidclog, UserManager } from 'oidc-client';
import {KJUR} from 'jsrsasign';

const AUTH_URL = 'https://accounts.kbb1.com/auth/realms/main';
export const BASE_URL = process.env.NODE_ENV === 'production' ? process.env.REACT_APP_WF_URL : 'http://localhost:3000/';

oidclog.logger = console;
oidclog.level  = 0;

const userManagerConfig = {
    authority: AUTH_URL,
    client_id: 'wf-admin',
    redirect_uri: `${BASE_URL}`,
    response_type: 'token id_token',
    scope: 'profile',
    post_logout_redirect_uri: `${BASE_URL}`,
    automaticSilentRenew: false,
    filterProtocolClaims: true,
    loadUserInfo: true,
};

export const client = new UserManager(userManagerConfig);

export const getUser = (cb) =>
    client.getUser().then((user) => {
        if(user){
            let at = KJUR.jws.JWS.parse(user.access_token);
            let roles = at.payloadObj.realm_access.roles;
            user = {...user.profile, roles}
        }
        cb(user)
    })
        .catch(function(error) {
            console.log("Error: ",error);
        });

export default client;
