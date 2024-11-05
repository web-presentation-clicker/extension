
browser.runtime.onMessage.addListener(
    (msg, sender, respond) => {
        respond("test");
    });

