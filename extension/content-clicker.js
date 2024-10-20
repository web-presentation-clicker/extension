
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
    // simulate right arrow
    let doc = getPresentationDoc();
    if (doc == null) return false;
    // keyup is not needed, but included for completeness
    doc.dispatchEvent(mkRightArrowEvent('keydown'));
    doc.dispatchEvent(mkRightArrowEvent('keyup'));
    // keypress is not sent for arrow keys
}

function prevSlide() {
    // simulate left arrow
    let doc = getPresentationDoc();
    if (doc == null) return false;
    // keyup is not needed, but included for completeness
    doc.dispatchEvent(mkLeftArrowEvent('keydown'));
    doc.dispatchEvent(mkLeftArrowEvent('keyup'));
    // keypress is not sent for arrow keys
}

setInterval(() => {
    console.log('advancing slide');
    nextSlide();
}, 1000);

setInterval(() => {
    console.log('previous slide');
    prevSlide();
}, 1100);


