// for use in combination with a script that implements getPresentationElement()
// getPresentationElement() must return the element that should have arrow keys sent to it, or null if there is none.

const mkRightArrowEvent = (type) => new KeyboardEvent(type, {'key': 'ArrowRight', 'code': 'ArrowRight', 'keyCode': 39});
const mkLeftArrowEvent = (type) => new KeyboardEvent(type, {'key': 'ArrowLeft', 'code': 'ArrowLeft', 'keyCode': 38});

function nextSlide() {
    console.log("advancing slide");
    // simulate right arrow
    let el = getPresentationElement();
    if (el == null) return false;
    // keyup is not needed, but included for completeness
    el.dispatchEvent(mkRightArrowEvent('keydown'));
    el.dispatchEvent(mkRightArrowEvent('keyup'));
    // keypress is not sent for arrow keys
}

function prevSlide() {
    console.log("going back a slide");
    // simulate left arrow
    let el = getPresentationElement();
    if (el == null) return false;
    // keyup is not needed, but included for completeness
    el.dispatchEvent(mkLeftArrowEvent('keydown'));
    el.dispatchEvent(mkLeftArrowEvent('keyup'));
    // keypress is not sent for arrow keys
}
