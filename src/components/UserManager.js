import { Log as oidclog, UserManager } from 'oidc-client';
import {KJUR} from 'jsrsasign';

const AUTH_URL = 'https://accounts.kbb1.com/auth/realms/groups';
export const BASE_URL = process.env.NODE_ENV === 'production' ? process.env.REACT_APP_GXY_URL : 'http://localhost:3000/';

oidclog.logger = console;
oidclog.level  = 3;

const userManagerConfig = {
    authority: AUTH_URL,
    client_id: 'galaxy',
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
            //user = {...user.profile, roles}
            const {sub,given_name,name,email} = user.profile;
            user = {
                id: sub,
                title: given_name,
                username: given_name,
                name,
                email,
                roles
            }
        }
        cb(user)
    })
        .catch(function(error) {
            console.log("Error: ",error);
        });

export default client;
