const Utils = {
    /**
     * Formats a date object into a readable string.
     * @param {Date} date - The date object to format.
     * @returns {string} - Formatted date string.
     */
    formatDate: function (date) {
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        return date.toLocaleDateString(undefined, options);
    },

    /**
     * Generates a random integer between min and max (inclusive).
     * @param {number} min - Minimum integer value.
     * @param {number} max - Maximum integer value.
     * @returns {number} - Random integer between min and max.
     *    
     */
    getRandomInt: function (min, max) {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    formatFileSize: function (bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

};

export default Utils;