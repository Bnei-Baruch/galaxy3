import axios from 'axios';
import pako from 'pako';

import {
  MONITORING_BACKEND,
} from "./consts";

const monitoringAPI = axios.create({
  baseURL: `${MONITORING_BACKEND}/`,
  // withCredentials: true,
  transformRequest: axios.defaults.transformRequest.concat(
    function (data, headers) {
      // compress strings if over 1KB
      if (typeof data === 'string' && data.length > 1024) {
        headers['Content-Encoding'] = 'gzip';
        return pako.gzip(data);
      } else {
        // delete is slow apparently, faster to set to undefined
        headers['Content-Encoding'] = undefined;
        return data;
      }
    }
  )
});

export default monitoringAPI;
