import { describe, it, expect } from "vitest";

import { cloudinaryCardImage } from "./cloudinaryImage";

describe("cloudinaryCardImage", () => {

    it("caps the width and lets Cloudinary auto-pick format/quality", () => {

        const url = "https://res.cloudinary.com/demo/image/upload/v1234/restroos/tenant-1/menu/abc.jpg";

        expect(cloudinaryCardImage(url)).toBe(
            "https://res.cloudinary.com/demo/image/upload/w_500,c_limit,q_auto,f_auto/v1234/restroos/tenant-1/menu/abc.jpg"
        );

    });

    it("honors a custom max width", () => {

        const url = "https://res.cloudinary.com/demo/image/upload/v1234/abc.jpg";

        expect(cloudinaryCardImage(url, 200)).toContain("w_200,c_limit");

    });

    it("leaves a non-Cloudinary URL untouched", () => {

        const url = "https://example.com/some-image.jpg";

        expect(cloudinaryCardImage(url)).toBe(url);

    });

    it("passes through a falsy value unchanged rather than throwing", () => {

        expect(cloudinaryCardImage(null)).toBe(null);
        expect(cloudinaryCardImage(undefined)).toBe(undefined);

    });

});
