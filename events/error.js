module.exports = {
    name: 'error',
    trigger: 'error',
    once: false,
    async execute(error) {
        console.error(error);
    }
}