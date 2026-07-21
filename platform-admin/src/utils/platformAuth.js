export const getStoredAuth = () => {

    try {
        return JSON.parse(localStorage.getItem("platformAdmin"));
    } catch {
        return null;
    }

};

export const setStoredAuth = (auth) => {
    localStorage.setItem("platformAdmin", JSON.stringify(auth));
};

export const clearStoredAuth = () => {
    localStorage.removeItem("platformAdmin");
};
