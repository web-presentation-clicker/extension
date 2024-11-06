const SESSION_STATE = 0;
const MAKE_SESSION = 1;
const CLICKER_NEXT_SLIDE = 2;
const CLICKER_PREV_SLIDE = 3;

// session states
const SESSION_STATE_NULL = -1;          // no session ever existed
const SESSION_STATE_DEAD = 0;           // session existed, but died
const SESSION_STATE_CONNECTING = 1;     // connecting to server
const SESSION_STATE_ESTABLISHED = 2;    // requesting session from server
const SESSION_STATE_ACTIVE = 3;         // session exists on server, waiting for clicker
const SESSION_STATE_PRESENTING = 4;     // clicker sent hello, ready to present

let ws = null;
let session = {
    state: SESSION_STATE_NULL,
    exists: false
};

let uuid_str = null;
let uuid_bytes = null;
let uuid_b64 = null;
let nonce = 0;

// devel
// const baseURL = 'http://localhost:6969';
// const baseWSURL = 'ws://localhost:6969';

// production
const baseURL = 'https://on-stage.click';
const baseWSURL = 'wss://on-stage.click';

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


// message event handler after connection is established, handles events
const onmessage_connected = e => {
    switch (e.data) {
        case "hello": {
            console.log("pinged by clicker");
            if (session.state == SESSION_STATE_ACTIVE) {
                session.state = SESSION_STATE_PRESENTING;
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
            if (e.data.startsWith('ERR: ')) {
                error = e.data.substr(5);
                console.error("error from server: " + error);

                // assume explicit error from server means the session is no longer usable
                session.error = error;
                session.exists = false;
                session.state = SESSION_STATE_DEAD;
                send_session_state();
                ws.close();
            } else {
                console.log('unknown event from server: ' + e.data);
                // do nothing about this for now
            }
        } break;
    }
    
}

// message event handler while creating a new session
const onmessage_init = e => {
    // session created?
    if (e.data.startsWith('uuid: ')) {
        console.log("session created");
        uuid_str = e.data.substr(6);
        uuid_bytes = decode_uuid(uuid_str);
        uuid_b64 = encode_b64(uuid_bytes);

        session.url = `${baseURL}/${uuid_b64}`;
        session.exists = true;
        session.state = SESSION_STATE_ACTIVE;
        send_session_state();

        ws.onmessage = onmessage_connected;
        return;
    }

    // anything else is an error
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
};

// message event handler when resuming a session
const onmessage_resume = e => {
    // session resumed?
    if (e.data == 'resumed') {
        console.log("session resumed");
        session.state = SESSION_STATE_ACTIVE;
        send_session_state();

        ws.onmessage = onmessage_connected;
        return;
    }

    // anything else is an error
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
};


// onopen when creating new session
const onopen_init = () => {
    console.log('opened');
    session.state = SESSION_STATE_ESTABLISHED;
    send_session_state();

    // ask for session
    ws.send('v1');
    ws.send('new');
};

// onopen when resuming session
const onopen_resume = () => {
    console.log('opened');
    session.state = SESSION_STATE_ESTABLISHED;
    send_session_state();

    // ask to resume session
    ws.send('v1');
    ws.send('resume: ' + uuid_str);
};


// normal onerror and onclose
const onerror_init = e => {
    console.error(e);
};

const onclose_init = e => {
    console.log('death');

    // if not an explicit death, mark dead and send event
    if (session.state != SESSION_STATE_DEAD) {
        session.error = "Lost connection";
        session.state = SESSION_STATE_DEAD;
        send_session_state();
    }

    // todo: auto-resume if session still exists
};


function new_session() {
    if (ws != null) ws.close();
    ws = new WebSocket(baseWSURL + "/api/v1/ws");
    session = {state: SESSION_STATE_CONNECTING, exists: false, error: null};
    ws.onopen = onopen_init;
    ws.onmessage = onmessage_init;
    ws.onerror = onerror_init;
    ws.onclose = onclose_init;
    send_session_state();
}

function resume_session() {
    if (ws != null) ws.close();
    ws = new WebSocket(baseWSURL + "/api/v1/ws");
    session.error = null;
    session.state = SESSION_STATE_CONNECTING;
    ws.onopen = onopen_resume;
    ws.onmessage = onmessage_resume;
    ws.onerror = onerror_init;
    ws.onclose = onclose_init;
    send_session_state();
}

const send_session_state = () => browser.runtime.sendMessage({event: SESSION_STATE, "session": session});


browser.runtime.onMessage.addListener(
    (msg, sender, respond) => {
        console.log("bg onmessage", msg);
        switch (msg.event) {
            case MAKE_SESSION: {
                if (content_clickers.length == 0) {
                    console.log("no content clickers, refusing to start session");
                    respond(null);
                    return;
                }

                // create a session or return the currently active one
                if (!session.exists) new_session();
                else if (session.state == SESSION_STATE_DEAD) resume_session();
                respond(session);
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
    });

    content_clickers.push(port);
});
