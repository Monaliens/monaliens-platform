const fs = require('fs').promises;
const path = require('path');

async function importFinalWhitelist() {
  try {
    console.log('Reading final-whitelist.json...');


    const finalWhitelistPath = path.join(__dirname, '../final-whitelist.json');
    const data = await fs.readFile(finalWhitelistPath, 'utf8');
    const finalWhitelist = JSON.parse(data);

    console.log(`Found ${finalWhitelist.totalAddresses} total addresses`);
    console.log(`- FCFS: ${finalWhitelist.fcfsCount} addresses`);
    console.log(`- GTD: ${finalWhitelist.gtdCount} addresses`);
    console.log(`- Both: ${finalWhitelist.bothCount} addresses`);


    const fcfsPath = path.join(__dirname, '../whitelists/fcfs/spins_fcfs.json');
    let fcfsList;

    try {
      const fcfsData = await fs.readFile(fcfsPath, 'utf8');
      fcfsList = JSON.parse(fcfsData);
      console.log(`\nExisting spins_fcfs has ${fcfsList.addresses.length} addresses`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('\nCreating new spins_fcfs list...');
        fcfsList = {
          name: 'spins_fcfs',
          category: 'fcfs',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          addresses: []
        };
      } else {
        throw error;
      }
    }


    const gtdPath = path.join(__dirname, '../whitelists/gtd/spins_gtd.json');
    let gtdList;

    try {
      const gtdData = await fs.readFile(gtdPath, 'utf8');
      gtdList = JSON.parse(gtdData);
      console.log(`Existing spins_gtd has ${gtdList.addresses.length} addresses`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('Creating new spins_gtd list...');
        gtdList = {
          name: 'spins_gtd',
          category: 'gtd',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          addresses: []
        };
      } else {
        throw error;
      }
    }


    const fcfsAddresses = finalWhitelist.fcfs || [];
    const newFcfsAddresses = fcfsAddresses.filter(addr =>
      !fcfsList.addresses.includes(addr.toLowerCase())
    );

    if (newFcfsAddresses.length > 0) {
      fcfsList.addresses.push(...newFcfsAddresses.map(a => a.toLowerCase()));
      fcfsList.updatedAt = new Date().toISOString();
      console.log(`\nAdding ${newFcfsAddresses.length} new addresses to spins_fcfs`);
    } else {
      console.log('\nNo new FCFS addresses to add');
    }

    // GTD listesine ekle (GTD + Both adreslerini)

    const bothAddresses = finalWhitelist.both || [];
    const gtdOnlyAddresses = finalWhitelist.gtd || [];
    const allGtdAddresses = [...gtdOnlyAddresses, ...bothAddresses];

    const newGtdAddresses = allGtdAddresses.filter(addr =>
      !gtdList.addresses.includes(addr.toLowerCase())
    );

    if (newGtdAddresses.length > 0) {
      gtdList.addresses.push(...newGtdAddresses.map(a => a.toLowerCase()));
      gtdList.updatedAt = new Date().toISOString();
      console.log(`Adding ${newGtdAddresses.length} new addresses to spins_gtd`);
      console.log(`  - ${gtdOnlyAddresses.length} from 'gtd' field`);
      console.log(`  - ${bothAddresses.length} from 'both' field (GTD priority)`);
    } else {
      console.log('No new GTD addresses to add');
    }

    // Listeleri kaydet
    await fs.writeFile(fcfsPath, JSON.stringify(fcfsList, null, 2));
    await fs.writeFile(gtdPath, JSON.stringify(gtdList, null, 2));

    console.log('\n Import completed successfully!');
    console.log(`Final spins_fcfs: ${fcfsList.addresses.length} addresses`);
    console.log(`Final spins_gtd: ${gtdList.addresses.length} addresses`);

  } catch (error) {
    console.error(' Import failed:', error.message);
    process.exit(1);
  }
}

importFinalWhitelist();