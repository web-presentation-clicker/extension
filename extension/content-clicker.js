const CLICKER_NEXT_SLIDE = 2;
const CLICKER_PREV_SLIDE = 3;

const mkRightArrowEvent = (type) => new KeyboardEvent(type, {'key': 'ArrowRight', 'code': 'ArrowRight', 'keyCode': 39});
const mkLeftArrowEvent = (type) => new KeyboardEvent(type, {'key': 'ArrowLeft', 'code': 'ArrowLeft', 'keyCode': 38});

function getPresentationDoc() {
    let frame = document.querySelector('.punch-present-iframe');
    if (frame == null) {
        console.log('no presentation frame! not presenting?');
        return null;
    }
    return frame.contentDocument;
}

function nextSlide() {
    console.log("advancing slide");
    // simulate right arrow
    let doc = getPresentationDoc();
    if (doc == null) return false;
    // keyup is not needed, but included for completeness
    doc.dispatchEvent(mkRightArrowEvent('keydown'));
    doc.dispatchEvent(mkRightArrowEvent('keyup'));
    // keypress is not sent for arrow keys
}

function prevSlide() {
    console.log("going back a slide");
    // simulate left arrow
    let doc = getPresentationDoc();
    if (doc == null) return false;
    // keyup is not needed, but included for completeness
    doc.dispatchEvent(mkLeftArrowEvent('keydown'));
    doc.dispatchEvent(mkLeftArrowEvent('keyup'));
    // keypress is not sent for arrow keys
}

let port = browser.runtime.connect({name: "placeholder"}); // todo

console.log("registering onMessage listener");
port.onMessage.addListener(
    (msg) => {
        switch (msg.event) {
            case CLICKER_NEXT_SLIDE: {
                nextSlide();
            } break;
            case CLICKER_PREV_SLIDE: {
                prevSlide();
            } break;
        }
    });
