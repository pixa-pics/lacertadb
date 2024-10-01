# Chromium's Base64 algorithm 🚀

Welcome to the `chromium-base64` module - where encoding meets lightning speed! ⚡

## Overview 📖

`chromium-base64` is a supercharged JavaScript module for Base64 encoding and decoding. It's like `base64-js` but on steroids! 💪 With performance gains of nearly +80% (almost double the speed 🏎️), it's the new heavyweight champion in the encoding arena!

### The Magic Behind 🧙‍♂️

Our hero, Matias Affolter 🦸‍♂️, delved deep into the Base64 algorithm and discovered the secret sauce used in Chromium's implementation by Nick Galbreath. This module is a testament to their combined genius, featuring low-level JavaScript (LLJS) close to asm.js style. It's like C and JS had a baby that's super efficient! 🍼

## Installation 📦

```bash
npm install chrominium-base64
```

## Usage 🛠

Importing and using `chromium-base64` is a walk in the park:

```javascript
var { B64chromium } = require('chromium-base64');
// `/dist/browser.min.js` --> var base64 = new window.B64chromium();

var base64 = new B64chromium();
var prefixpng = "data:image/png;base64,";
var base64str = "iVBORw0KGgoAAAANSUhEUgAAAGMAAABrCAMAAABUtszKAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAABIUExURWySsQkAAA0AJyUVHA4AAN2Ha/m9l0dwTP///xEPPPKlg2gvLy4hMq5VT/jWrB8pWok9PeTazKOCbzxRf9G3cw0UYu/vj2NdX+nzxzMAAAAIdFJOU/r///////8AlmOzPQAAB9VJREFUaN7tmOmCozoOhQELpg0mgCHw/m86krzbbOmZ+++qqrsCAX8+2myo/vyD9h/zp/rzz9u/jH8ZVwbOpDP8/H9lADQ87oS2OqODV5zqjQI7emTEqNDwo4T/lWGdM5W2eo58UFO9IaSWkxCzwvqXjFNCSWLMeqPlhnFOENu2FiDCTFD9yrCZlNm+oXXdJgpFiLmKfvWDm5q61ptG23bUU3puvXBY9cpNDZuuaxSx7yhGNttZfNYJ3jKgHL9p6mPXNWzdZhC75rOFz+AVI/ipiQw17PhTg1Ti223bvoevE0wZleoq2E1mAHonN+EoFcV933R8XYQpINU5oikM6nbfFxyh6oZqwqhsS+rPyGtwzygQdMRnFM5eTwvasUwmKnnQLiDVCcL6P72tqTe9rcioqmWRR0f5W+aeO3hgWELKmHBuOHVVLdWEjPVYMObouJMML4VUGcIlUR3PiogAVByLxj67or/0LoCuolR6gpwyDELS5TWPxL+AqaSX6U+1LhXW+saSCV8HRcbFmbdOGM5PsgEeobZgdBZGg9rfopeuizqM4aQQuGI4RG2y1SPIDahDdaumxFpWpBxu9vi1uW6yfuUJ3jD8uHWE4InVoLa9w8TqMLX2vWtcMhhPOopz9PeSUZfmwojfCYJg0Kuu02k+uYut6/DMJYPnDnWTMxxko3bSYZEvrm+kCKJYyHV9mCQthLgUBsBuiLHYvKP4fFPqv2HAHcMNxenceCVNc8L43vWrAkERxXMKe/qhTVp5O+omhkf20NvrMC+/A0WGUkKUjNqGMI3h8xplxUNklnEc+oQB9OMd0CTxvmVAZnW56pl5pHr5ineMdHgXYyZUepUe5KYTMK8Ykhsq3Ue/Pu5uRFqlZMg0pw2vR2cyTW/wtNYqbcpQgQ1LyqDGbpZGX37WgTgjgZRaawH3jK1WpELR5qQB7/GEMcmsYmp7DEJxAuh7hqQcEj7tXUQ8o4oZMiqi8HiFd90z0Ek1+JUBcoa0jCZneCkA4n49Z4gdoIEaMgb+oQJZzxj2NoqIfN6LgpIhGDbtZcIILcxVh4NQ9r7Z77LaEAxTWuZMI5eCAVGN88EbhqS0Aojq181yPSgci9aHCAtHdI2AtwyuckUmHESQDc6UUMJ+Jcx1ZP7qV75y94dRyWY283E4M/iB4edYEoLlHDz1i44SMT/bOI4OIv+CEUbJDeVwoOaxJbPeetHbJyuZxxcm3naQ1MZBuIRo+55OnDurupTBDOFNDbpz9sF/CBCcVi0etPPMEPGWAYEhBo13auWGax0FCZiqqM+d6VmZ+pGBXh68hzicCo/tgBwH83Xfm3MkhBn1D4zZBwH/jjzq3PKAyBwGjvnA4cbxDYODLtofGCMxMCMPercwCCyJeUTG59ObiOOxVsehZqYQhCtL9K8Zg8lO1yIE0mbW8fmQ9/Ert1egQBkGJ5pon9bzkLrWQziMUMcijqH1DA7RsB205cJhlaDzxKCAiPGRISMGehh16EXTLlQPOPmWMxeHxBzD/quPpR1GkwrImEn0+KyjiRgURwqvtlnbtobR9x+TrjNnFknjzBoxIGLsHxkQGJSWPaeVydA2MHxJ4JnPxzFI9vw7g8aieHYxI7aPRXQsmvNd/cAw1RAsY3yCuSJEzRgV8feMPmV8ckZrgoNV8pYh/o7R/szo3zG8q/A/qvbpNSMXYhk2rboEYWX0hBHiYZ9IowOvTPPYpkp4ouZTwvBt11JwsXnLGG4YfYkwrjKF+MTgVY8X0PEEUjK6SEbf67YfXujADsWtzTmrj+vD9I0+QLpIBpbHpkfxxJD8zIWt7XAbhQiCY9h653Me4aPRYZckhnjH0LyCJIwe14yRhqMe/2FIl8qgBs37DLh9L2p2sBh2aRkBwmsfOaSfWz9+LEMfm35mTH6XjELsahuEUM+jxbDrIz9FjEHt2yxeMQQzOsdok4BgkPq428a1AWLZhHpiyMBAm8c86mbhSHIqZpinBaqvJ4aKGJkQ8lJ3pUPTPQcLuWMI+3BjGINlBCW9yad0WXGMg/YohqGu3+9K3mR4hooYdgdF+wPXGnMGb1jfM+xjzphC2vBUEFF8dVBvwDvp7huGCg94/E7GIeyWNDPfvAxDv2LQ46wQKuiYE8gwpk8hdh1xjMHc/MQQnhH2o3ZA11kjB9l1xDHA3UyM6Yox5YxIiO/eEYIhkYwAUeqKwa5yFZhmb+vqzNL64Kcgw92eOStmTIrXwJiRRcRG3pdMhFAxQ10zhJVr1kHvrfbM+mC8i3c7DeOuS4aEiKGgCPsNYgxvOIWtr1sGXSCEghNI3xddJPZUgCTLbZW4SnhGdNMc5a/bvZ20EUje38TOqoqHG96VqHhiQ8gtv0F0iDbq6rGSS4ZwDJEwvJI+bBAjFeMJI2nvVeQq/2YiQ8SQNBo+BaCEBCERAyKGSO8Z3FsXUxSxiJGrM387D+cMKSJvQs4IkCRpR9sBThiiZDhXXTGGk2IcHaJtvidCcobrHWYBKW4w77EyCB+brbb8nijJGUHGCcK/LpuT92P2+QQZ+nvGgIIRZEBp5QvK2T8CIWP6fpsSkjOkSBHinmGekQNCngmROcNVuevRt4wIgQwEfE8YAOcM/9r1jjHbfbCtxIkRJ84qGBC7KMveuhbXCP21Jl8y4JzRiPhVr93MG8jx9VZfMP4LQFw1rniVR08AAAAASUVORK5CYII="; // Made with pixa.pics

console.log(prefixpng + base64.bytesToBase64(base64.base64ToBytes(base64str)));
//console.log(base64.base64ToBytes(base64str)) // -> Uint8Array
```

## Performance Numbers 📈

**Based on a base64 string of 128kB:**
 * `base64-js` (most popular "2023" base64 npm module) takes 2116ms for a thousand rounds of toBytes and toBase64.
 * `chromium-base64` zips through the same in just 1256ms! 🌪️

## Credits 👏

 * **Nick Galbreath** - The original mastermind behind the high-performance base64 encoder/decoder in Chromium.
 * **Matias Affolter** - The visionary who brought Nick's algorithm to the JavaScript world, enhancing it with the finesse of LLJS.

## License 📄
Licensed under the MIT License. See the LICENSE file for more details.

## Conclusion 🎬
`chromium-base64` isn't just a module; it's a revolution in Base64 encoding/decoding. Whether you're a coding newbie or a seasoned pro, this module is sure to add some zing to your project! 🌟

## Testing 

 > (PREFERABLY) RUN TEST WITH BINDING METHODS ONCE BEFORE LOADING TESTS:

```text
DATA TESTED: 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

chromium-base64--> 
Encoding Time (100x): 4.299999952316284 ms
Decoding Time (100x): 1.7000000476837158 ms
Combined Time (100x): 6.299999952316284 ms

base64-js--> 
Encoding Time (100x): 11.099999964237213 ms
Decoding Time (100x): 1.5999999642372131 ms
Combined Time (100x): 8.100000023841858 ms
```
```javascript
var b64chromium = new B64chromium();
var decode = b64chromium.base64ToBytes.bind(b64chromium);
var encode = b64chromium.bytesToBase64.bind(b64chromium);
var iter = 100;
```

## Forward Thinking 🌐

### Embracing Chromium's Legacy

`chromium-base64` isn't just about speed; it's about innovation and pushing boundaries. We draw inspiration from the finest in the field - Google Chrome. 🌟

Google Chrome, renowned for its efficiency, uses a decoder that's a work of art in its own right. Developed by Nick Galbreath, this "high-performance base64 encoder/decoder" is a cornerstone of Chromium's codebase. 🛠️

### The Secret Sauce: Pre-Shifted 32-bit Values

What sets Chromium's implementation apart, and what we've embraced in `chromium-base64`, is its unique approach to decoding. Traditional base64 decoders rely heavily on shifts, but Chromium's decoder plays it smart. It bypasses shifts entirely, opting instead for a method where bytes are looked up as "pre-shifted" 32-bit values. 🧠💡

This approach isn't just about being different; it's about being better. It results in a decoder that's not only fast but also more efficient and reliable.

For the curious minds who want to dive deeper into this marvel, check out the detailed implementation at [Lemire's fastbase64](https://github.com/lemire/fastbase64/tree/master). 📚

### Looking Ahead

In `chromium-base64`, we don't just code for today; we code for tomorrow. We're always on the lookout for ways to innovate and improve, keeping pace with the ever-evolving tech landscape. 🚀

Join us in this journey of exploration and excellence. With `chromium-base64`, the future of encoding is here and now! 🌌

---

*Note: "Chromium" and "Google Chrome" are trademarks of Google LLC. The use of these names is for reference purposes only and does not imply any affiliation or endorsement by Google LLC.*
