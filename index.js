import 'dotenv/config';
import Discord from 'discord.js';
import fetch from 'node-fetch';
import constants from './constants.js';
import { ethers } from "ethers";

const discordBot = new Discord.Client;

const discordSetup = async (channelID) => {
    return new Promise((resolve, reject) => {
        if (!process.env['DISCORD_BOT_TOKEN']) reject('DISCORD_BOT_TOKEN not set')
        discordBot.login(process.env.DISCORD_BOT_TOKEN);
        discordBot.on('ready', async () => {
            const channel = await discordBot.channels.fetch(channelID);
            resolve(channel);
        });
    })
}

const buildMessage = (sale) => (
    new Discord.MessageEmbed()
        .setColor('#0099ff')
        .setTitle(sale.asset.name + ' VENDIDO!')
        .setURL(sale.asset.permalink)
        .setAuthor('JASArmas OpenSeaBot', "https://i.imgur.com/E1wwtQH.png", 'https://github.com/jasarmas/opensea-discord-bot-updates')
        .setThumbnail(sale.asset.collection.image_url)
        .addFields(
            { name: 'Nombre', value: sale.asset.name },
            { name: 'Monto en ETH', value: `${ethers.utils.formatEther(sale.total_price || '0')}${ethers.constants.EtherSymbol}` },
            { name: 'Comprador', value: sale?.winner_account?.address, },
            { name: 'Vendedor', value: sale?.seller?.address, },
        )
        .setImage(sale.asset.image_url)
        .setTimestamp(Date.parse(`${sale?.created_date}Z`))
        .setFooter('Vendido en OpenSea', 'https://i.imgur.com/E1wwtQH.png')
)

const main = async () => {
    const seconds = process.env.SECONDS ? parseInt(process.env.SECONDS) : 3_600;
    const hoursAgo = (Math.round(new Date().getTime() / 1000) - (seconds * 4));

    const params = new URLSearchParams({
        offset: '0',
        event_type: 'successful',
        only_opensea: 'false',
        occurred_after: hoursAgo.toString(),
        collection_slug: process.env.COLLECTION_SLUG,
    })

    let openSeaFetch = {}
    if (process.env.OPENSEA_TOKEN) {
        openSeaFetch['headers'] = { 'X-API-KEY': process.env.OPENSEA_TOKEN }
    }

    let responseTxt = "";

    try {
        const openSeaResponseObj = await fetch(
            "https://api.opensea.io/api/v1/events?" + params, openSeaFetch
        );

        responseTxt = await openSeaResponseObj.text();

        const openSeaResponse = JSON.parse(responseTxt);

        return await Promise.all(
            openSeaResponse?.asset_events?.reverse().map(async (sale) => {
                if (sale.asset.name == null) sale.asset.name = 'Unnamed NFT';

                const assetName = sale.asset.name.toLowerCase()
                const lastIndex = assetName.lastIndexOf(" ")
                const shortAssetName = assetName.substring(0, lastIndex)

                if (!constants.validNftNames.includes(shortAssetName)) return

                const message = buildMessage(sale);

                return await Promise.all(
                    process.env.DISCORD_CHANNEL_ID.split(';').map(async (channel) => {
                        return await (await discordSetup(channel)).send(message)
                    })
                );
            })
        );
    } catch (e) {
        throw e;
    }
}

main()
    .then((res) => {
        if (res && res.length === 0) {
            console.log("No recent sales")
        }
        process.exit(0)
    })
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
