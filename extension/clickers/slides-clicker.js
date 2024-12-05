function getPresentationElement() {
    let frame = document.querySelector('.punch-present-iframe');
    if (frame == null) {
        console.log('no presentation frame! not presenting?');
        return null;
    }
    return frame.contentDocument;
}