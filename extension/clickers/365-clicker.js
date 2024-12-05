function getPresentationElement() {
    let el = document.getElementById('SlideShowContainer');
    if (el == null) 
        console.log('no slide show container! not presenting?');

    return el;
}