/**
 * Yalnızca mevcut CalcomateSides pilot yönetim projesinin editöründe çalıştırın.
 * Bu dosya normal derleme ve dağıtım paketlerine dahil değildir.
 * Kimlik denetimi mevcut adminMutate/adminQuery işlevlerinden geçer.
 */
function pilotReplayCheck() {
  var props = PropertiesService.getScriptProperties();
  var config = {
    ORGANIZATION_ID: 'calcomatesides-pilot',
    CONTENT_SHEET_ID: '17Ux0nhVsOL-0pWAWh84aWWvxpEUb3UG2sWHGNAAe-M0',
    DONATIONS_SHEET_ID: '1TDqDh6vgBvifsf3TCJW-0zO-kw5hKxpdOKOMX1EgNv8',
    PUBLIC_SHEET_ID: '1TMemOB7FiTvKkskyNBRjBa4a3UWKAZUqgKAQfmgeaB8'
  };
  Object.keys(config).forEach(function(key) {
    if (props.getProperty(key) !== config[key]) throw new Error('Pilot yapılandırması eşleşmiyor. İşlem durduruldu.');
  });
  var fields = {
    date: '2026-11-11', amountMinor: 12345, currency: 'TRY', method: 'cash',
    campaign: 'ÖRNEK — Pilot kontrolü', donor: '', reference: 'ORNEK-PILOT-ELLE-01',
    note: 'ÖRNEK VERİ — gerçek bağış değildir.'
  };
  var requests = [
    { action: 'donation.save', requestId: 'pilot-manual-replay-20261111', fields: fields },
    { action: 'donation.import', requestId: 'pilot-csv-replay-20261111', rows: [
      Object.assign({}, fields, { reference: 'ORNEK-PILOT-CSV-01' })
    ] }
  ];
  function data(reply) {
    if (!reply || !reply.ok) throw new Error('Pilot işlemi başarısız. Kod ' + (reply && reply.code || 'UNKNOWN'));
    return reply.data;
  }
  var results = requests.map(function(request) {
    var first = data(adminMutate(request));
    var repeated = data(adminMutate(request));
    if (!repeated.repeated || JSON.stringify(first.ids) !== JSON.stringify(repeated.ids)) {
      throw new Error('Tekrarlanan isteğin kimlikleri eşleşmedi.');
    }
    return { action: request.action, requestId: request.requestId, ids: first.ids, repeated: repeated.repeated };
  });
  var archive = data(adminQuery('exportData', null));
  requests.forEach(function(request) {
    var matches = archive.log.donations.filter(function(entry) { return entry.requestId === request.requestId; });
    if (matches.length !== 1 || matches[0].count !== 1) throw new Error('Günlükte tek işlem ve tek kayıt doğrulanamadı.');
  });
  Logger.log(JSON.stringify({ ok: true, checkedAt: new Date().toISOString(), tests: results }));
  return results;
}
