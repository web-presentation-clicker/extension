const SESSION_STATE = 0;
const MAKE_SESSION = 1;
const CLICKER_NEXT_SLIDE = 2;
const CLICKER_PREV_SLIDE = 3;
const END_SESSION = 4;
const SETTINGS_UPDATE = 5;

// session states
const SESSION_STATE_NULL = -1;          // no session ever existed
const SESSION_STATE_DEAD = 0;           // session existed, but died
const SESSION_STATE_CONNECTING = 1;     // connecting to server
const SESSION_STATE_ESTABLISHED = 2;    // requesting session from server
const SESSION_STATE_ACTIVE = 3;         // session exists on server

const OFFICIAL_SERVER = 'on-stage.click';

const is_chrome = typeof browser === 'undefined';
if (is_chrome) var browser = chrome;

const new_null_session = () => ({
    state: SESSION_STATE_NULL,
    exists: false,
    error: null,
    presenting: false
});

let ws = null;
let session = new_null_session();

let uuid_str = null;
let uuid_bytes = null;
let uuid_b64 = null;
let reconnect = false;
let nonce = 0;

let local_settings = {};
const get_server = () => typeof local_settings.server === 'undefined' ? OFFICIAL_SERVER : local_settings.server;
const get_base_url = () => 'https://' + get_server();
const get_base_ws_url = () => 'wss://' + get_server();

let content_clickers = [];


// utils
function decode_hex_digit(d) {
    if ((d & 0xF0) == 0x30) { // num (0011xxxx)
        let num = d & 0x0F;
        if (num < 10) return num;
    } else if ((d & 0xD8) == 0x40) { // letter (01x00xxx)
        let num = (d & 0x07) + 9;
        if (num < 16 && num > 9) return num;
    }
    throw 'Invalid hex digit';
}

function decode_uuid(uuid) {            
    let hex = uuid.replaceAll('-', '');
    if (hex.length != 32) throw 'invalid number of digits in uuid';
    let bytes = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
        let high = decode_hex_digit(hex.charCodeAt(i*2));
        let low = decode_hex_digit(hex.charCodeAt(i*2+1));
        bytes[i] = (high << 4) + low;
    }
    return bytes;
}

// I read the rfc and did the thing with the thing. no, I'm not importing a library just for this.
function encode_b64(bytes) {
    const b64Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let out = '';
    let bptr = 0;
    let radBuff = bytes[bptr++];
    let radBuffSize = 8;
    let d;
    while (bptr < bytes.length) {
        if (radBuffSize < 6 && bptr < bytes.length) {
            radBuff = radBuff << 8;
            radBuff += bytes[bptr++];
            radBuffSize += 8;
        }
        d = radBuff >> (radBuffSize - 6);
        out += b64Alphabet.charAt(d);
        radBuffSize -= 6;
        radBuff -= d << radBuffSize;
    }
    if (radBuffSize > 0) {
        d = radBuff << 6 - radBuffSize;
        out += b64Alphabet.charAt(d);
    }
    // padding is not needed
    return out;
}


function send_click(e) {
    if (content_clickers.length == 0) console.warn("no content clickers to click");
    
    // for now just send to all registered content clickers
    content_clickers.forEach((port) => port.postMessage({event: e, "nonce": nonce}))
    nonce++;
}


let socket_listeners = null;
class SocketListeners {
    // prevent old sessions from breaking new ones
    is_valid = () => socket_listeners === this;

    // message event handler after connection is established, handles events
    onmessage_connected = e => {
        if (!this.is_valid()) return;

        switch (e.data) {
            case "hello": {
                console.log("pinged by clicker");
                if (!session.presenting) {
                    session.presenting = true;
                    send_session_state();
                }
            } break;

            case "next_slide": {
                console.log("next slide");
                send_click(CLICKER_NEXT_SLIDE);
            } break;

            case "prev_slide": {
                console.log("prev slide");
                send_click(CLICKER_PREV_SLIDE);
            } break;

            default: {
                // handle error, ignore unknown
                if (e.data.startsWith('ERR: ')) handle_onmessage_error(e);
                else console.log('unknown event from server: ' + e.data);
            } break;
        }
        
    }

    handle_onmessage_error(e) {
        if (!this.is_valid()) return;

        let error;
        if (e.data.startsWith('ERR: ')) {
            error = e.data.substr(5);
            console.error("error from server: " + error);
        } else {
            error = "unknown error";
            console.error('unknown event from server: ' + e.data);
        }

        session.error = error;
        session.exists = false;
        session.state = SESSION_STATE_DEAD;
        send_session_state();
        ws.close();
    }

    // message event handler while creating a new session
    onmessage_init = e => {
        if (!this.is_valid()) return;

        // session created?
        if (e.data.startsWith('uuid: ')) {
            console.log("session created");
            uuid_str = e.data.substr(6);
            uuid_bytes = decode_uuid(uuid_str);
            uuid_b64 = encode_b64(uuid_bytes);

            session.url = `${get_base_url()}/${uuid_b64}`;
            session.exists = true;
            session.state = SESSION_STATE_ACTIVE;
            send_session_state();

            ws.onmessage = this.onmessage_connected;
            return;
        }

        // anything else is an error
        handle_onmessage_error(e);
    };

    // message event handler when resuming a session
    onmessage_resume = e => {
        if (!this.is_valid()) return;

        // session resumed?
        if (e.data == 'resumed') {
            console.log("session resumed");
            session.state = SESSION_STATE_ACTIVE;
            send_session_state();

            ws.onmessage = this.onmessage_connected;
            return;
        }

        // anything else is an error
        handle_onmessage_error(e);
    };


    // onopen when creating new session
    onopen_init = () => {
        if (!this.is_valid()) return;

        console.log('opened');
        session.state = SESSION_STATE_ESTABLISHED;
        send_session_state();

        // ask for session
        ws.send('v1');
        ws.send('new');
    };

    // onopen when resuming session
    onopen_resume = () => {
        if (!this.is_valid()) return;

        console.log('opened');
        session.state = SESSION_STATE_ESTABLISHED;
        send_session_state();

        // ask to resume session
        ws.send('v1');
        ws.send('resume: ' + uuid_str);
    };


    // normal onerror and onclose
    onerror_init = e => {
        if (!this.is_valid()) return;

        console.error(e);
    };

    onclose_init = e => {
        if (!this.is_valid()) return;

        console.log('death');

        // if not an explicit death, mark dead and send event
        if (session.state > SESSION_STATE_DEAD) {
            session.error = "Lost connection";
            session.state = SESSION_STATE_DEAD;
            send_session_state();
        }

        if (session.exists && reconnect) {
            console.log('resuming after lost connection');
            resume_session();
        }
    };

    attach_new(ws) {
        ws.onopen = this.onopen_init;
        ws.onmessage = this.onmessage_init;
        ws.onerror = this.onerror_init;
        ws.onclose = this.onclose_init;
    }

    attach_resume(ws) {
        ws.onopen = this.onopen_resume;
        ws.onmessage = this.onmessage_resume;
        ws.onerror = this.onerror_init;
        ws.onclose = this.onclose_init;
    }
}


function new_session() {
    close_connection();

    reconnect = true;
    ws = new WebSocket(get_base_ws_url() + "/api/v1/ws");
    session = new_null_session();
    session.state = SESSION_STATE_CONNECTING;
    
    socket_listeners = new SocketListeners();
    socket_listeners.attach_new(ws);

    send_session_state();
    start_keepalive();
}

function resume_session() {
    close_connection();

    reconnect = true;
    ws = new WebSocket(get_base_ws_url() + "/api/v1/ws");
    session.error = null;
    session.state = SESSION_STATE_CONNECTING;

    socket_listeners = new SocketListeners();
    socket_listeners.attach_resume(ws);

    send_session_state();
    start_keepalive();
}

function close_connection() {
    reconnect = false;
    if (ws != null) {
        ws.close();
        ws = null;
    }
    socket_listeners = null;
}

function end_session() {
    console.log("ending session");

    if (ws != null && ws.readyState == ws.OPEN) ws.send('end');
    session.state = SESSION_STATE_DEAD;
    close_connection();
    session = new_null_session();
    session.error = "Session Ended";
    send_session_state();
    stop_keepalive();
}

const send_session_state = () => browser.runtime.sendMessage({event: SESSION_STATE, "session": session});


let keepalive_interval = null;
function keepalive() {
    // ping server through websocket so extension doesn't die
    if (ws != null && session.state >= SESSION_STATE_ACTIVE) {
        console.log("pinging server");
        ws.send('A');
    }
}

function start_keepalive() {
    if (!is_chrome) return;  // issue only affects chrome
    if (keepalive_interval != null) clearInterval(keepalive_interval);
    keepalive_interval = setInterval(keepalive, 20000);
}

function stop_keepalive() {
    if (keepalive_interval != null) clearInterval(keepalive_interval);
}

function mk_session() {
    // create a session or return the currently active one
    if (!session.exists) new_session();
    else if (session.state == SESSION_STATE_DEAD) resume_session();
}

function update_settings() {
    return browser.storage.local.get()
        .then(s => local_settings = s);
}

browser.runtime.onMessage.addListener(
    (msg, sender, respond) => {
        console.log("bg onmessage", msg);
        switch (msg.event) {
            case MAKE_SESSION: {
                if (!session.exists && content_clickers.length == 0) {
                    console.log("no content clickers, refusing to start session");
                    respond(null);
                    return;
                }

                // get baseurl
                if (typeof local_settings.server === 'undefined') {
                    console.log('updating settings before making session');
                    update_settings()
                        .then(s => {
                            // make session and send it when done
                            mk_session();
                            send_session_state();
                        });
                } else {
                    mk_session();
                }

                respond(session);
            } break;
            case END_SESSION: {
                end_session();
                respond(session);
            } break;
            case SETTINGS_UPDATE: {
                end_session();
                update_settings()
                    .then(() => respond(true));
            } break;
        }
    });

browser.runtime.onConnect.addListener((port) => {
    if (port.name != "clicker") return;

    console.log("registering content clicker");
    port.onDisconnect.addListener((port) => {
        console.log("content clicker connection died:", port.error);
        let index = content_clickers.indexOf(port);
        if (index != -1) content_clickers.splice(index, 1);

        if (content_clickers.length == 0 && ws != null) {
            console.log("killing socket because no presentations to click");
            close_connection();
            stop_keepalive();
        }
    });

    content_clickers.push(port);
});
