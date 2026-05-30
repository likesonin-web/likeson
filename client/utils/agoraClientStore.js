 

let _client = null;
let _joined = false;

export const setAgoraClient = (client) => { _client = client; };
export const clearAgoraClient = () => { _client = null; _joined = false; };
export const getAgoraClient = () => _client;

export const setAgoraJoined = (v) => { _joined = v; };
export const isAgoraJoined = () => _joined;