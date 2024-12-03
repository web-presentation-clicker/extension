const SESSION_STATE = 0;
const MAKE_SESSION = 1;
const END_SESSION = 4;

// session states
const SESSION_STATE_NULL = -1;          // no session ever existed
const SESSION_STATE_DEAD = 0;           // session existed, but died
const SESSION_STATE_CONNECTING = 1;     // connecting to server
const SESSION_STATE_ESTABLISHED = 2;    // requesting session from server
const SESSION_STATE_ACTIVE = 3;         // session exists on server

const OFFICIAL_SERVER = 'on-stage.click';

// helpers
const hide = (e) => e.style.display = 'none';
const unhide = (e) => e.style.display = '';

const message = document.getElementById("message");
const toggle_qr = document.getElementById("toggle-qr");
const end_session_b = document.getElementById("end-session");
const logo = document.getElementById("logo");
const custom_server_message = document.getElementById("custom-server-message");
const custom_server_setting = document.getElementById("set-server");
const qrcode_element = document.getElementById("qrcode");
const qrcode = new QRCode(qrcode_element, {
    width : 300,
    height : 300
});

if (typeof browser === 'undefined') var browser = chrome;

let qr_toggled = false;
let qr_generated = false;
let local_settings = {};
const get_server = () => typeof local_settings.server === 'undefined' ? OFFICIAL_SERVER : local_settings.server;

hide(toggle_qr);
hide(qrcode_element);
hide(end_session_b);
hide(custom_server_message);
hide(custom_server_setting);
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
        hide(toggle_qr);
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

function set_server(new_server) {
    local_settings.server = new_server;
    browser.storage.local.set(local_settings);
    update_custom_server_message();
    // todo: update background service after this
}

function show_custom_server_setting() {
    const server_field = document.getElementById("server-field");
    const update_button = document.getElementById("update-server");
    const reset_server = document.getElementById("reset-server");
    update_button.onclick = () => {
        set_server(server_field.value);
        hide(custom_server_setting);
    }
    reset_server.onclick = () => {
        server_field.value = OFFICIAL_SERVER;
        set_server(OFFICIAL_SERVER);
    };

    let server = get_server();
    server_field.value = server;

    hide(custom_server_message);
    unhide(custom_server_setting);
}

function update_custom_server_message() {
    const custom_server_addr = document.getElementById("server-addr");
    const change_server = document.getElementById("change-server");
    change_server.onclick = () => show_custom_server_setting();

    let server = get_server();
    if (server === OFFICIAL_SERVER) {
        hide(custom_server_message);
        return;
    }

    custom_server_addr.innerText = server;
    unhide(custom_server_message);
}

const logo_required_clicks = 5;
const logo_brightness_steps = 255 / logo_required_clicks;
let logo_counter = 0;
let logo_timeout_duration = 2000;
let logo_timeout = null;
logo.onclick = () => {
    // reset timeout
    if (logo_timeout != null) clearTimeout(logo_timeout);
    logo_timeout = setTimeout(
        () => {
            logo_counter = 0;
            logo.style.backgroundColor = "";
        }, logo_timeout_duration);

    logo_counter++;

    let brightness = Math.min(logo_brightness_steps * logo_counter, 255);
    let color = brightness | (brightness << 8) | (brightness << 16);
    logo.style.backgroundColor = "#" + (color).toString(16);

    // show options to set a custom server
    if (logo_counter < logo_required_clicks) return;
    show_custom_server_setting();
};

toggle_qr.onclick = (e) => {
    qr_toggled = !qr_toggled;
    update_qrcode_toggle();
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

function init() {
    update_custom_server_message();

    // tell background service to get a working session
    browser.runtime.sendMessage({event: MAKE_SESSION})
        .then((s) => {
            if (s == null) {
                message.innerHTML = "No presentation found. Supported sites:<br><ul><li>Google Slides</li></ul>"
                return;
            }
            on_session_state(s);
        });
}


browser.storage.local.get()
    .then(s => {
        local_settings = s;
        init();
    });