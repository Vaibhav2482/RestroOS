import { describe, it, expect } from "vitest";

import { cloudinaryThumbnail } from "./cloudinaryImage";

describe("cloudinaryThumbnail", () => {

    it("inserts a fill-crop transform sized to the requested box", () => {

        const url = "https://res.cloudinary.com/demo/image/upload/v1234/restroos/tenant-1/menu/abc.jpg";

        expect(cloudinaryThumbnail(url, 96)).toBe(
            "https://res.cloudinary.com/demo/image/upload/w_96,h_96,c_fill,q_auto,f_auto/v1234/restroos/tenant-1/menu/abc.jpg"
        );

    });

    it("leaves a non-Cloudinary URL untouched", () => {

        const url = "https://example.com/some-image.jpg";

        expect(cloudinaryThumbnail(url, 96)).toBe(url);

    });

    it("passes through a falsy value unchanged rather than throwing", () => {

        expect(cloudinaryThumbnail(null, 96)).toBe(null);
        expect(cloudinaryThumbnail(undefined, 96)).toBe(undefined);
        expect(cloudinaryThumbnail("", 96)).toBe("");

    });

});
