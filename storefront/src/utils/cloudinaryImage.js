// Every menu image on the grid was requesting the same full-resolution
// original regardless of how small the card renders it - real bandwidth/
// LCP cost on mobile, where most ordering happens. The grid is responsive
// (see ItemImage in Home.jsx), so there's no single fixed display size to
// crop to the way a tenant-admin thumbnail can; capping the width and
// letting Cloudinary auto-pick format/quality (`f_auto,q_auto`) is the
// right tradeoff here - a card is never wider than maxWidth below even on
// a large desktop grid. Falls back to the original URL untouched for
// anything that isn't a Cloudinary delivery URL (no "/upload/" segment).
export const cloudinaryCardImage = (url, maxWidth = 500) => {

    if (!url || !url.includes("/upload/")) {
        return url;
    }

    return url.replace("/upload/", `/upload/w_${maxWidth},c_limit,q_auto,f_auto/`);

};
