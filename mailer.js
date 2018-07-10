const nodemailer = require('nodemailer');
const config = require('./config.json');

var date = new Date().toLocaleDateString().replace(/^/, '-').replace(/\//g, ".")

const mailer = {
    transporter: nodemailer.createTransport({
        port: 587,
        host: 'smtp.outlook.office365.com',
        secure: false,
        auth: {
            user: 'performance.reports@emxdigital.com',
            pass: 'Scotch@Puffy'
        },
        tls: {
            ciphers: "SSLv3",
            rejectUnauthorized: false
        }
    }),
    mailOptions: {
        from: 'performance.reports@emxdigital.com',
        to: config.emailTo,
        subject: 'CMP Scraper Results',
        text: 'CMP Scrape Results..',
        html: '<b>Check out the attachment... </b>',
        attachments: [{
            filename: `cmp-scrape-results${date}.csv`,
            path: `${__dirname}\/cmp-scrape-results${date}.csv`
        }]
    },
    sendMail: function() {
        this.transporter.sendMail(this.mailOptions, function (err, info) {
            if (err) {
                console.log(err)
            } else {
                console.log(`Message sent! ${info.response}`);
            }
        })
    }
}

module.exports = mailer;