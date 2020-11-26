import {ADMIN_SECRET, API_BACKEND, AUTH_API_BACKEND, JANUS_ADMIN_GXY,} from "./env";
import {randomString} from "./tools";

class Api {

    constructor() {
        this.accessToken = null;
        this.username = null;
        this.password = null;
    }

    static makeParams = params => (
        `${Object.entries(params)
            .filter(([_, v]) => v !== undefined && v !== null)
            .map((pair) => {
                const key = pair[0];
                const value = pair[1];
                if (Array.isArray(value)) {
                    return value.map(val => `${key}=${Api.encode(val)}`).join('&');
                }
                return `${key}=${Api.encode(value)}`;
            })
            //can happen if parameter value is empty array
            .filter(p => p !== '')
            .join('&')}`
    );

    static encode = encodeURIComponent;

    // Galaxy API

    fetchConfig = () =>
        this.logAndParse('fetch config', fetch(this.urlFor('/v2/config'), this.defaultOptions()));

    fetchAvailableRooms = (params = {}) =>
        this.logAndParse('fetch available rooms',
            fetch(`${this.urlFor('/groups')}?${Api.makeParams(params)}`, this.defaultOptions()));

    fetchActiveRooms = () =>
        this.logAndParse('fetch active rooms', fetch(this.urlFor('/rooms'), this.defaultOptions()));

    fetchRoom = (id) =>
        this.logAndParse(`fetch room ${id}`, fetch(this.urlFor(`/room/${id}`), this.defaultOptions()));

    fetchUsers = () =>
        this.logAndParse('fetch users', fetch(this.urlFor('/users'), this.defaultOptions()));

    fetchQuad = (col) =>
        this.logAndParse(`fetch quad ${col}`, fetch(this.urlFor(`/qids/q${col}`), this.defaultOptions()));

    fetchProgram = () =>
        this.logAndParse('fetch program', fetch(this.urlFor('/qids'), this.defaultOptions()));

    fetchRoomsStatistics = () =>
        this.logAndParse('fetch rooms statistics', fetch(this.urlFor('/v2/rooms_statistics'), this.defaultOptions()));

    updateQuad = (col, data) => {
        const options = this.makeOptions('PUT', data);
        return this.logAndParse(`update quad ${col}`, fetch(this.urlFor(`/qids/q${col}`), options));
    }

    updateUser = (id, data) => {
        const options = this.makeOptions('PUT', data);
        return this.logAndParse(`update user ${id}`, fetch(this.urlFor(`/users/${id}`), options));
    }
    sendQuestion = (data) => {
        const options = this.makeOptions('POST', data);
        return this.logAndParse(`send question`, fetch(`https://qst.kli.one/api/ask`, options)); 
    }
    getQuestions = (data) => {
        const options = this.makeOptions('POST',data);     
        return this.logAndParse(`get questions`, fetch(`https://qst.kli.one/api/feed`, options)); 
    }

    updateRoom = (id, data) => {
        const options = this.makeOptions('PUT', data);
        return this.logAndParse(`update room ${id}`, fetch(this.urlFor(`/rooms/${id}`), options));
    }

    // Admin API

    adminFetchGateways = (params = {}) =>
        this.logAndParse('admin fetch gateways',
            fetch(`${this.urlFor('/admin/gateways')}?${Api.makeParams(params)}`, this.defaultOptions()));

    fetchHandleInfo = (gateway, session_id, handle_id) =>
        this.logAndParse('fetch handle_info',
            fetch(this.urlFor(`/admin/gateways/${gateway}/sessions/${session_id}/handles/${handle_id}/info`), this.defaultOptions()));

    adminFetchRooms = (params = {}) =>
        this.logAndParse('admin fetch rooms',
            fetch(`${this.urlFor('/admin/rooms')}?${Api.makeParams(params)}`, this.defaultOptions()));

    adminCreateRoom = (data) => {
        const options = this.makeOptions('POST', data);
        return this.logAndParse(`admin create room`, fetch(this.urlFor("/admin/rooms"), options));
    }

    adminUpdateRoom = (id, data) => {
        const options = this.makeOptions('PUT', data);
        return this.logAndParse(`admin update room`, fetch(this.urlFor(`/admin/rooms/${id}`), options));
    }

    adminDeleteRoom = (id) => {
        const options = this.makeOptions('DELETE');
        return this.logAndParse(`admin delete room`, fetch(this.urlFor(`/admin/rooms/${id}`), options));
    }

    adminSetConfig = (key, value) => {
        const options = this.makeOptions('POST', {value});
        return this.logAndParse(`admin set config`, fetch(this.urlFor(`/admin/dynamic_config/${key}`), options));
    }

    adminResetRoomsStatistics = () => {
        const options = this.makeOptions('DELETE');
        return this.logAndParse(`admin reset rooms statistics`, fetch(this.urlFor('/admin/rooms_statistics'), options));
    }

    adminListParticipants = (request, name) => {
        let payload = { "janus": "message_plugin", "transaction": randomString(12), "admin_secret": ADMIN_SECRET, plugin: "janus.plugin.videoroom", request};
        const options = this.makeOptions('POST', payload);
        return this.logAndParse(`admin list participants`, fetch(this.adminUrlFor(name), options));
    }

    // Auth Helper API

    verifyUser = (pendingEmail, action) =>
        this.logAndParse(`verify user ${pendingEmail}, ${action}`, fetch(this.authUrlFor(`/verify?email=${pendingEmail}&action=${action}`), this.defaultOptions()));

    requestToVerify = (email) =>
        this.logAndParse(`request to verify user ${email}`, fetch(this.authUrlFor(`/request?email=${email}`), this.defaultOptions()));

    fetchUserInfo = () =>
        this.logAndParse(`refresh user info`, fetch(this.authUrlFor('/my_info'), this.defaultOptions()));

    urlFor = (path) => (API_BACKEND + path)
    authUrlFor = (path) => (AUTH_API_BACKEND + path)
    adminUrlFor = (name) => ('https://' + name + JANUS_ADMIN_GXY)

    defaultOptions = () => {
        const auth = this.accessToken ?
            `Bearer ${this.accessToken}` :
            `Basic ${btoa(`${this.username}:${this.password}`)}`;

        return {
            headers: {
                'Authorization': auth,
            }
        };
    };

    makeOptions = (method, payload) => {
        const options = {
            ...this.defaultOptions(),
            method,
        };
        if (payload) {
            options.body = JSON.stringify(payload);
            options.headers['Content-Type'] = 'application/json';
        }
        return options;
    };

    logAndParse = (action, fetchPromise) => {
        return fetchPromise
            .then(response => {
                if (!response.ok) {
                    throw Error(response.statusText);
                }
                return response.json();
            })
            .then(data => {
                //console.debug(`[API] ${action} success`, data);
                return data;
            })
            .catch(err => {
                console.error(`[API] ${action} error`, err);
                return Promise.reject(err);
            });
    }

    setAccessToken = (token) => {
        this.accessToken = token;
    }

    setBasicAuth = (username, password) => {
        this.username = username;
        this.password = password;
    }
}

// Helpers for tests / local dev
/* class MockApi {
    fetchConfig = () =>
        new Promise((resolve, reject) => resolve({
            gateways: [{name: "gxytest", url: "http://localhost:8088/janus", type: "rooms", token: "secret"}],
            ice_servers: [],
        }))
} */

// const defaultApi = new MockApi();

const defaultApi = new Api();

export default defaultApi;
