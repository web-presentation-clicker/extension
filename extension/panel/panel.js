const SESSION_STATE = 0;
const MAKE_SESSION = 1;
const END_SESSION = 4;

// session states
const SESSION_STATE_NULL = -1;          // no session ever existed
const SESSION_STATE_DEAD = 0;           // session existed, but died
const SESSION_STATE_CONNECTING = 1;     // connecting to server
const SESSION_STATE_ESTABLISHED = 2;    // requesting session from server
const SESSION_STATE_ACTIVE = 3;         // session exists on server

// helpers
const hide = (e) => e.style.display = 'none';
const unhide = (e) => e.style.display = '';

const message = document.getElementById("message");
const toggle_qr = document.getElementById("toggle-qr");
const end_session_b = document.getElementById("end-session");
const qrcode_element = document.getElementById("qrcode");
const qrcode = new QRCode(qrcode_element, {
    width : 300,
    height : 300
});

if (typeof browser === 'undefined') var browser = chrome;

let qr_toggled = false;
let qr_generated = false;

message.innerText = "Initializing...";

function update_qrcode_toggle() {
    if (qr_toggled) {
        unhide(qrcode_element);
        toggle_qr.textContent = "Hide QR Code";
    } else {
        hide(qrcode_element);
        toggle_qr.textContent = "Show QR Code";
    }
}

function generate_qr(s) {
    console.log("generating qr: " + s.url);
    qrcode.makeCode(s.url);
    qr_generated = true;
}

function on_session_state(s) {
    if (s.exists) {
        // show/hide qr code control
        if (s.presenting) {
            // show qr toggle
            update_qrcode_toggle();

            // make sure qr code exists before showing button
            if (!qr_generated) generate_qr(s);
            unhide(toggle_qr);
        } else {
            hide(toggle_qr);
        }

        unhide(end_session_b);
    } else {
        hide(qrcode_element);
        hide(end_session_b);
    }

    // show connection state to user
    switch (s.state) {
        case SESSION_STATE_NULL:
        case SESSION_STATE_DEAD: {
            message.innerText = s.error != null ? s.error : "Not Connected";
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
                message.innerText = "Connected!";
                return;
            }

            // display qr
            generate_qr(s);
            unhide(qrcode_element);
            message.innerText = "Scan the QR Code with your phone.";
        } break;
    }
}

toggle_qr.onclick = (e) => {
    qr_toggled = !qr_toggled;
    update_qrcode_toggle();
};

end_session_b.onclick = (e) => browser.runtime.sendMessage({event: END_SESSION});

hide(toggle_qr);
hide(qrcode_element);

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
            message.innerHTML = "No presentation found. Supported sites:<br><ul><li>Google Slides</li></ul>"
            return;
        }
        on_session_state(s);
    });
