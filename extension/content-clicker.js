const CLICKER_NEXT_SLIDE = 2;
const CLICKER_PREV_SLIDE = 3;

if (typeof browser === 'undefined') var browser = chrome;

let port = null;
let r_int = null;
let nonce = -1;

function connect() {
    console.log("connecting to background service");
    port = browser.runtime.connect({name: "clicker"});

    port.onMessage.addListener(
        (msg) => {
            switch (msg.event) {
                case CLICKER_NEXT_SLIDE: {
                    if (msg.nonce == nonce) return; // duplicate event from race-condition
                    nonce = msg.nonce;
                    nextSlide();
                } break;
                case CLICKER_PREV_SLIDE: {
                    if (msg.nonce == nonce) return;
                    nonce = msg.nonce;
                    prevSlide();
                } break;
            }
        });

    // reconnect on disconnect
    port.onDisconnect.addListener(connect);
}

// interval for keeping the background service alive
r_int = setInterval(() => {
    let old_port = port;
    connect();
    setTimeout(() => old_port.disconnect(), 5000);  // chrome race condition
}, 25000);

// initial connection
connect();
