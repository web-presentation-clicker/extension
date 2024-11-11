const SESSION_STATE = 0;
const MAKE_SESSION = 1;
const END_SESSION = 4;

// session states
const SESSION_STATE_NULL = -1;          // no session ever existed
const SESSION_STATE_DEAD = 0;           // session existed, but died
const SESSION_STATE_CONNECTING = 1;     // connecting to server
const SESSION_STATE_ESTABLISHED = 2;    // requesting session from server
const SESSION_STATE_ACTIVE = 3;         // session exists on server

const message = document.getElementById("message");
const toggle_qr = document.getElementById("toggle-qr");
const end_session_b = document.getElementById("end-session");
const qrcode_element = document.getElementById("qrcode");
const qrcode = new QRCode(document.getElementById("qrcode"), {
    width : 300,
    height : 300
});

if (typeof browser === 'undefined') var browser = chrome;

let qr_toggled = false;
let qr_generated = false;

message.innerText = "Initializing...";

function on_session_state(s) {
    if (s.exists) {

        // show/hide qr code control
        if (s.presenting) {
            // show qr toggle
            if (qr_toggled) {
                qrcode_element.style.display = "block";
                toggle_qr.textContent = "Hide QR Code";
            } else {
                qrcode_element.style.display = "none";
                toggle_qr.textContent = "Show QR Code";
            }
    
            // make sure qr code exists before showing button
            if (!qr_generated) {
                console.log("generating qr: " + s.url);
                qrcode.makeCode(s.url);
                qr_generated = true;
            }
    
            toggle_qr.style.display = "block";
        } else {
            // hide qr toggle
            toggle_qr.style.display = "none";
        }

        end_session_b.style.display = "block"
    } else {
        qrcode_element.style.display = "none"
        end_session_b.style.display = "none"
    }

    // show connection state to user
    switch (s.state) {
        case SESSION_STATE_NULL:
        case SESSION_STATE_DEAD: {
            message.innerText = s.error != null ? s.error : "Disconnected";
        } break;
        case SESSION_STATE_CONNECTING: {
            message.innerText = s.exists ? "Reconnecting..." : "Connecting...";
        } break;
        case SESSION_STATE_ESTABLISHED: {
            message.innerText = s.exists ? "Resuming session..." : "Requesting new session...";
        } break;
        case SESSION_STATE_ACTIVE: {
            // don't show QR if already presenting
            if (s.presenting) {
                message.innerText = "Connected";
                return;
            }

            // display qr
            console.log("generating qr: " + s.url);
            qrcode.makeCode(s.url);
            qr_generated = true;
            qrcode_element.style.display = "block";
            message.innerText = "Scan the QR Code on your phone";
        } break;
    }
}

toggle_qr.onclick = (e) => {
    qr_toggled = !qr_toggled;

    if (qr_toggled) {
        qrcode_element.style.display = "block";
        toggle_qr.textContent = "Hide QR Code";
    } else {
        qrcode_element.style.display = "none";
        toggle_qr.textContent = "Show QR Code";
    }
};

end_session_b.onclick = (e) => browser.runtime.sendMessage({event: END_SESSION});

browser.runtime.onMessage.addListener(
    (msg, sender, resp) => {
        switch (msg.event) {
            case SESSION_STATE: {
                on_session_state(msg.session);
            } break;
        }
    });

// tell background service to get a working session
browser.runtime.sendMessage({event: MAKE_SESSION})
    .then((s) => {
        if (s == null) {
            message.innerText = "No presentation found";
            return;
        }
        on_session_state(s);
    });
