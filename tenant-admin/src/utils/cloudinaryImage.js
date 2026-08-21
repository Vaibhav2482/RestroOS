// A 48-64px thumbnail was requesting the same full-resolution original as
// a menu item's hero image - real bandwidth/LCP cost on the tablets this
// app runs on at the counter. Cloudinary serves a resized/optimized
// derivative for free if the transform is in the URL; `c_fill` crops to
// the exact box instead of just capping the longest edge, matching the
// fixed-size thumbnail slots these are used in. Falls back to the
// original URL untouched for anything that isn't a Cloudinary delivery
// URL (no "/upload/" segment), so a future non-Cloudinary source degrades
// gracefully instead of breaking.
export const cloudinaryThumbnail = (url, size) => {

    if (!url || !url.includes("/upload/")) {
        return url;
    }

    return url.replace("/upload/", `/upload/w_${size},h_${size},c_fill,q_auto,f_auto/`);

};
