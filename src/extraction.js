const { getAttribute, addUrlParameters } = require('./util.js');

/**
 * Extracts information about all rooms listed by the hotel.
 * @param {Page} page - The Puppeteer page object.
 */
const extractRooms = async (page) => {
    let roomType;
    let bedText;
    let features;
    const rooms = [];

    console.log('extractRooms...');

    // Function for extracting occupancy info.
    const occExtractor = (hprt) => {
        if (!hprt) { return null; }
        /* eslint-disable */
        const occ1 = document.querySelector('.hprt-occupancy-occupancy-info .invisible_spoken');
        const occ2 = document.querySelector('.hprt-occupancy-occupancy-info').getAttribute('data-title');
        const occ3 = document.querySelector('.hprt-occupancy-occupancy-info').textContent;
        /* eslint-enable */
        return occ1 ? occ1.textContent : (occ2 || occ3);
    };

    // Iterate all table rows.
    const rows = await page.$$('.hprt-table > tbody > tr:not(.hprt-cheapest-block-row)');
    if (rows && rows.length > 0) { console.log('extracting ' + rows.length + ' rooms...'); }
    for (const row of rows) {
        console.log('row = ' + row);
        const roomRow = await row.$('.hprt-table-cell-roomtype');
        if (roomRow) {
            roomType = await row.$('.hprt-roomtype-icon-link');
            const bedType = await row.$('.hprt-roomtype-bed');
            bedText = bedType ? await getAttribute(bedType, 'textContent') : null;

            // Iterate and parse all room facilities.
            const facilities = roomRow ? await roomRow.$$('.hprt-facilities-facility') : null;
            features = [];
            if (facilities) {
                for (const f of facilities) {
                    const fText = (await getAttribute(f, 'textContent')).replace('•', '').trim();
                    if (fText.indexOf('ft²') > -1) {
                        const num = parseInt(fText.split(' ')[0], 10);
                        const nText = `${parseInt(num * 0.092903, 10)} m²`;
                        features.push(nText);
                    } else { features.push(fText); }
                }
            }
        }

        // Extract data for each room.
        let occupancy;
        try {
            occupancy = await row.$eval('.hprt-occupancy-occupancy-info', occExtractor);
        } catch (e) { occupancy = null; }
        const persons = occupancy ? occupancy.match(/\d+/) : null;
        
        console.log('1before price...');
        const priceE = await row.$('.prco-valign-middle-helper');
        const priceT = priceE ? (await getAttribute(priceE, 'textContent')).replace(/\s|,/g, '').match(/(\d|\.)+/) : null;
        const priceC = priceE ? (await getAttribute(priceE, 'textContent')).replace(/\s|,/g, '').match(/[^\d.]+/) : null;
        console.log('1after priceT = ' + priceT);
        console.log('1after priceC = ' + priceC);

        const cond = await row.$$('.hprt-conditions li');

        const room = { available: true };
        if (roomType) { room.roomType = await getAttribute(roomType, 'textContent'); }
        if (bedText) { room.bedType = bedText.replace(/\n+/g, ' '); }
        if (persons) { room.persons = parseInt(persons[0], 10); }
        if (priceT && priceC) {
            room.price = parseFloat(priceT[0]);
            room.currency = priceC[0];
            room.features = features;
        } else { room.available = false; }
        if (cond.length > 0) {
            room.conditions = [];
            for(const c of cond){
                const cText = await getAttribute(c, 'textContent');
                room.conditions.push(cText.replace(/(\n|\s)+/g, ' '));
            }
        }
        await rooms.push(room);
    }
    return rooms;
};

/**
 * Extracts information about all rooms listed by the hotel using jQuery in browser context.
 */
const extractRoomsJQuery = async () => {
    console.log('extractRoomsJQuery...');

    let roomType;
    let bedText;
    let features;
    const rooms = [];
    const $ = jQuery;

    // Function for extracting occupancy info.
    const occExtractor = (row) => {
        if (!row || row.length < 1) { return null; }
        /* eslint-disable */
        const occ1 = row.find('.hprt-occupancy-occupancy-info .invisible_spoken');
        const occ2 = row.find('.hprt-occupancy-occupancy-info').attr('data-title');
        const occ3 = row.find('.hprt-occupancy-occupancy-info').text();
        /* eslint-enable */
        return occ1.length > 0 ? occ1.text() : (occ2 || occ3);
    };

    // Iterate all table rows.
    const rows = $('.hprt-table > tbody > tr:not(.hprt-cheapest-block-row)');
    if (rows && rows.length > 0) { console.log('extracting ' + rows.length + ' rooms...'); }
    for(let i = 0; i < rows.length; i++){
        
        const row = rows.eq(i);
        
        // Extract data from the roomtype section
        const roomRow = row.find('.hprt-table-cell-roomtype');
        if (roomRow.length > 0) {
            roomType = row.find('.hprt-roomtype-icon-link');
            const bedType = row.find('.hprt-roomtype-bed');
            bedText = bedType.length > 0 ? bedType.text() : null;

            // Iterate and parse all room facilities.
            features = [];
            const facilities = roomRow.find('.hprt-facilities-facility');
            if (facilities.length > 0) {
                for(let fi = 0; fi < facilities.length; fi++){
                    const f = facilities.eq(fi);
                    const fText = f.text().replace('•', '').trim();
                    if (fText.indexOf('ft²') > -1) {
                        const num = parseInt(fText.split(' ')[0], 10);
                        const nText = `${parseInt(num * 0.092903, 10)} m²`;
                        features.push(nText);
                    } else { features.push(fText); }
                }
            }
        }

        // Extract data for each room.
        let occupancy;
        try { occupancy = occExtractor(row); } catch (e) { occupancy = null; }
        const persons = occupancy ? occupancy.match(/\d+/) : null;

        
        // Extract data from the price section
        let priceT;
        let priceC;
        const priceRow = row.find('.hprt-table-cell-price');
        const temp1 = priceRow.html();
        console.log('priceRow.html() = ', temp1);
        
        if (priceRow.length > 0) {
            console.log('priceRow.length > 0');
            const priceE = priceRow.find('.bui-price-display__value');
            const temp2 = priceE.html();
            console.log('priceE.html() = ', temp2);
            if (priceE) {
                priceT = priceE.length > 0 ? priceE.html().replace(/\s|,/g, '').match(/(\d|\.)+/) : null;
                priceC = priceE.length > 0 ? priceE.html().replace(/\s|,/g, '').match(/[^\d.]+/) : null;
                console.log('priceT = ', priceT);
                console.log('priceC = ', priceC);
            }
        }

        

        
        const cond = row.find('.hprt-conditions li');

        const room = { available: true };
        if (roomType) { room.roomType = roomType.text().trim(); }
        if (bedText) { room.bedType = bedText.replace(/\n+/g, ' '); }
        if (persons) { room.persons = parseInt(persons[0], 10); }
        if (priceT && priceC) {
            room.price = parseFloat(priceT[0]);
            room.currency = priceC[0];
            room.features = features;
        } else { room.available = false; }
        if (cond.length > 0) {
            room.conditions = [];
            for(let ci = 0; ci < cond.length; ci++){
                const cText = cond.eq(ci).text().trim();
                room.conditions.push(cText.replace(/(\n|\s)+/g, ' '));
            }
        }
        rooms.push(room);
    }
    return rooms;
};

/**
 * Extracts information from the detail page.
 * @param {Page} page - The Puppeteer page object.
 * @param {Object} ld - JSON-LD Object extracted from the page.
 * @param {Object} input - The Actor input data object.
 */
module.exports.extractDetail = async (page, ld, input, userData) => {
    console.log("module.exports.extractDetail ...");

    const addr = ld.address || null;
    const address = {
        full: addr.streetAddress,
        postalCode: addr.postalCode,
        street: addr.addressLocality,
        country: addr.addressCountry,
        region: addr.addressRegion,
    };
    const html = await page.content();
    const name = await page.$('#hp_hotel_name');
    const nameText = (await getAttribute(name, 'textContent')).split('\n');
    const hType = await page.$('.hp__hotel-type-badge');
    const bFast = await page.$('.ph-item-copy-breakfast-option');
    const starIcon = await page.$('i.bk-icon-stars');
    const starTitle = await getAttribute(starIcon, 'title');
    const stars = starTitle ? starTitle.match(/\d/) : null;
    const loc = ld.hasMap ? ld.hasMap.match(/%7c(\d+\.\d+),(\d+\.\d+)/) : null;
    const cInOut = await page.$('.bui-date__subtitle');
    const cMatch = cInOut ? (await getAttribute(cInOut, 'textContent')).match(/\d+:(\d+)/g) : null;
    const img1 = await getAttribute(await page.$('.slick-track img'), 'src');
    const img2 = await getAttribute(await page.$('#photo_wrapper img'), 'src');
    const img3 = html.match(/large_url: '(.+)'/);
    //const rooms = await extractRooms(page);
    page.on('console', msg => {
        for (let i = 0; i < msg.args().length; ++i)
            console.log(`${i}: ${msg.args()[i]}`);
//            console.log('${msg.args()[i]}');
    });
    const rooms = await page.evaluate(extractRoomsJQuery);
    return {
        order: userData.order,
        url: addUrlParameters((await page.url()).split('?')[0], input),
        name: nameText[nameText.length - 1].trim(),
        type: await getAttribute(hType, 'textContent'),
        description: ld.description || null,
        stars: stars ? stars[0] : null,
        rating: ld.aggregateRating ? ld.aggregateRating.ratingValue : null,
        reviews: ld.aggregateRating ? ld.aggregateRating.reviewCount : null,
        breakfast: await getAttribute(bFast, 'textContent'),
        checkIn: (cMatch && cMatch.length > 1) ? cMatch[0] : null,
        checkOut: (cMatch && cMatch.length > 1) ? cMatch[1] : null,
        location: (loc && loc.length > 2) ? { lat: loc[1], lng: loc[2] } : null,
        address,
        image: img1 || img2 || (img3 ? img3[1] : null),
        rooms
    };
};

/**
 * Extracts data from a hotel list page.
 * NOTE: This function is to be used in page.evaluate.
 * @param {Object} input - The Actor input data object.
 */
module.exports.listPageFunction = (input) => new Promise((resolve, reject) => {
    /* eslint-disable */ 
    const $ = jQuery;
    /* eslint-enable */

    /**
     * Waits for a condition to be non-false.
     * @param {Function} condition - The condition Function.
     * @param {Function} callback - Callback to be executed when the waiting is done.
     */
    const waitFor = function(condition, callback, i) {
        const val = condition();
        if (val) {
            callback(val);
        } else if (i > 10) {
            callback(null);
        } else {
            setTimeout(() => { waitFor(condition, callback, i ? i + 1 : 1); }, 500);
        }
    }

    /** Gets total number of listings. */
    const getHeaderNumber = function () {
        const av = $('.availability_nr').text().trim().replace(/(\s|\.|,)+/g, '')
            .match(/\d+/);
        const h1 = $('.sr_header h1').text().replace(/(\s|\.|,)+/g, '').match(/\d+/);
        const h2 = $('.sr_header h2').text().replace(/(\s|\.|,)+/g, '').match(/\d+/);
        const h4 = $('#results_prev_next h4').text().replace(/(\s|\.|,)+/g, '').match(/\d+/);
        const fd = $('#sr-filter-descr').text().replace(/(\s|\.|,)+/g, '').match(/(\d+)de/);
        /* eslint-disable */
        return av ? av[0] : (h1 ? h1[0] : (h2 ? h2[0] : (h4 ? h4[0] : (fd ? fd[1] : null))));
        /* eslint-enable */
    };

    // Extract listing data.
    const result = [];
    const num = getHeaderNumber();
    const items = $('.sr_item');// $('.sr_item').eq(0).nextUntil('.sr_separator').addBack();
    console.log(`items: ${items.length}`);
    let started = 0;
    let finished = 0;

    // Iterate all items
    items.each(function (index, sr) {
        const jThis = $(this);
        const n1 = jThis.find('.score_from_number_of_reviews').text().replace(/(\s|\.|,)+/g, '').match(/\d+/);
        const n2 = jThis.find('.review-score-widget__subtext').text().replace(/(\s|\.|,)+/g, '').match(/\d+/);
        const n3 = jThis.find('.bui-review-score__text').text().replace(/(\s|\.|,)+/g, '').match(/\d+/);
        const nReviews = n1 || n2 || n3;

        ++started;
        sr.scrollIntoView();
        const getPrice = function () {
            const retPrice = $(sr).find('.bui-price-display__value, :not(strong).site_price, .totalPrice, strong.price');
            console.log(`retPrice: ${retPrice}`);
            return retPrice;
        };

        // When the price is ready, extract data.
        waitFor(() => { return getPrice().length > 0; }, () => {
            /* eslint-disable */
            const origin = window.location.origin;
            /* eslint-enable */
            const occ = jThis.find('.sr_max_occupancy i, .c-occupancy-icons__adults i').length;
            const rl1 = jThis.find('.room_link span').eq(0).contents();
            const rl2 = jThis.find('.room_link strong');
            const prtxt = getPrice().eq(0).text().trim()
                .replace(/,|\s/g, '');
            const pr = prtxt.match(/\d+/);
            const pc = prtxt.match(/[^\d]+/);
            const rat = $(sr).attr('data-score');
            const found = num ? parseInt(num, 10) : null;
            const starAttr = jThis.find('i.star_track svg').attr('class');
            const stars = starAttr ? starAttr.match(/\d/) : null;
            const buiLink1 = jThis.find('.bui-link--primary');
            const buiLink2 = jThis.find('a.district_link, .bui-link').eq(0);
            const address = (buiLink2.length > 0 ? buiLink2 : buiLink1.contents().eq(0)).text().trim().split('\n')[0].trim();
            const loc = (buiLink1.length > 0 ? buiLink1 : buiLink2).attr('data-coords');
            const latlng = loc ? loc.split(',') : null;
            const image = jThis.find('.sr_item_photo_link.sr_hotel_preview_track').attr('style');
            const imageRegexp = /url\((.*?)\)/gm;
            const imageParsed = imageRegexp.exec(image);
            const url = origin + jThis.find('.hotel_name_link').attr('href').replace(/\n/g, '');
            const item = {
                url: url.split('?')[0],
                name: $(sr).find('.sr-hotel__name').text().trim(),
                rating: rat ? parseFloat(rat.replace(',', '.')) : null,
                reviews: nReviews ? parseInt(nReviews[0], 10) : null,
                stars: stars ? parseInt(stars[0], 10) : null,
                price: pr ? parseFloat(pr[0]) : null,
                currency: pc ? pc[0].trim() : null,
                roomType: rl2.length > 0 ? rl2.text().trim() : rl1.eq(0).text().trim(),
                persons: occ || null,
                address: address,
                location: latlng ? { lat: latlng[0], lng: latlng[1] } : null,
                image: image
            };
            // if (!input.useFilters) { item.totalFound = found; }
            if (item.rating && item.rating >= (input.minScore || 0)/* && item.price > input.minPrice && item.price < input.maxPrice*/) { result.push(item); }
            if (++finished >= started) { resolve(result); }
        });
    });
});
