/*
 * Экспорт топографических данных карты из самой игры — для карт, которые
 * нельзя выгрузить через grad_meh (зашифрованные .ebo, например Cam Lao Nam).
 *
 * Как пользоваться (Arma 3 2.02 и новее):
 *   1. Запустите игру (лучше с -noPause -filePatching), откройте редактор на нужной карте
 *      (пустая миссия), нажмите «Играть».
 *   2. Esc → Debug Console → вставьте ВЕСЬ этот файл в поле кода → «Local Exec».
 *      (Или положите файл в папку миссии и выполните execVM "gradtopo_export.sqf".)
 *   3. Ждите: в чате идёт прогресс, на большой карте это 5–20 минут. Игру не сворачивайте.
 *      Когда в чате появится «GRADTOPO: done - you can close the game», закройте игру.
 *   4. Данные лежат в RPT-файле: %LOCALAPPDATA%\Arma 3\arma3_x64_<дата>.rpt.
 *      Дальше: node scripts/import-rpt.mjs <путь к .rpt> "<папка выгрузки>" --name "Cam Lao Nam" --author "SOG"
 *
 * Строки в RPT:
 *   GRADTOPO|META|<мир>|<размер>|<шаг>|<число узлов>
 *   GRADTOPO|H|<строка>|<с узла>|<высоты в дециметрах через запятую>   (с юга на север)
 *   GRADTOPO|B|<x1,y1,x2,y2,x3,y3,x4,y4>|<высота здания, м>
 *   GRADTOPO|R|<тип>|<ширина>|<x1,y1,x2,y2>
 *   GRADTOPO|L|<тип>|<название>|<x>|<y>
 *   GRADTOPO|END
 */

[] spawn {

private _size = worldSize;
private _step = 20;                       // шаг сетки высот, м
private _n = floor (_size / _step) + 1;
private _chunk = 150;                     // значений высот в одной строке RPT

private _say = {
	params ["_text"];
	systemChat format ["GRADTOPO: %1", _text];
};

diag_log format ["GRADTOPO|META|%1|%2|%3|%4", toLower worldName, _size, _step, _n];
["heights..."] call _say;

// ---- высоты: ASL, дециметры, строки с юга на север ----
for "_j" from 0 to (_n - 1) do {
	private _y = _j * _step;
	for "_i0" from 0 to (_n - 1) step _chunk do {
		private _values = [];
		for "_i" from _i0 to ((_i0 + _chunk - 1) min (_n - 1)) do {
			_values pushBack (round ((getTerrainHeightASL [_i * _step, _y]) * 10));
		};
		diag_log format ["GRADTOPO|H|%1|%2|%3", _j, _i0, _values joinString ","];
	};
	if (_j % 10 == 0) then {
		[format ["heights %1%%", round (100 * _j / _n)]] call _say;
		uiSleep 0.01;
	};
};

// ---- здания, дороги: по плиткам 500 м ----
private _tile = 500;
private _radius = 360;                    // охватывает плитку целиком
private _tiles = ceil (_size / _tile);
private _seenB = createHashMap;
private _seenR = createHashMap;
private _bTypes = [
	"BUILDING", "HOUSE", "CHURCH", "CHAPEL", "FUELSTATION", "HOSPITAL", "FORTRESS",
	"BUNKER", "LIGHTHOUSE", "QUAY", "TOURISM", "VIEW-TOWER", "WATERTOWER",
	"TRANSMITTER", "STACK", "RUIN", "SHIPWRECK"
];
private _count = 0;

for "_tx" from 0 to (_tiles - 1) do {
	for "_ty" from 0 to (_tiles - 1) do {
		private _center = [_tx * _tile + _tile / 2, _ty * _tile + _tile / 2, 0];

		{
			private _key = str _x;
			if !(_seenB getOrDefault [_key, false]) then {
				_seenB set [_key, true];
				private _bb = boundingBoxReal _x;
				private _mn = _bb select 0;
				private _mx = _bb select 1;
				private _pts = [
					_x modelToWorld [_mn select 0, _mn select 1, 0],
					_x modelToWorld [_mx select 0, _mn select 1, 0],
					_x modelToWorld [_mx select 0, _mx select 1, 0],
					_x modelToWorld [_mn select 0, _mx select 1, 0]
				];
				private _flat = [];
				{
					_flat pushBack (round ((_x select 0) * 2) / 2);
					_flat pushBack (round ((_x select 1) * 2) / 2);
				} forEach _pts;
				diag_log format ["GRADTOPO|B|%1|%2", _flat joinString ",", round ((_mx select 2) - (_mn select 2))];
				_count = _count + 1;
			};
		} forEach (nearestTerrainObjects [_center, _bTypes, _radius, false, true]);

		{
			private _key = str _x;
			if !(_seenR getOrDefault [_key, false]) then {
				_seenR set [_key, true];
				private _info = getRoadInfo _x;
				if (count _info >= 9) then {
					private _a = _info select 6;
					private _b = _info select 7;
					diag_log format [
						"GRADTOPO|R|%1|%2|%3,%4,%5,%6",
						_info select 0, _info select 1,
						round ((_a select 0) * 2) / 2, round ((_a select 1) * 2) / 2,
						round ((_b select 0) * 2) / 2, round ((_b select 1) * 2) / 2
					];
				};
			};
		} forEach (_center nearRoads _radius);
	};
	[format ["objects %1%%, buildings %2", round (100 * _tx / _tiles), _count]] call _say;
	uiSleep 0.01;
};

// ---- названия ----
{
	private _pos = locationPosition _x;
	private _name = ((text _x) splitString "|") joinString " ";
	if (_name != "") then {
		diag_log format ["GRADTOPO|L|%1|%2|%3|%4", type _x, _name, round (_pos select 0), round (_pos select 1)];
	};
} forEach (nearestLocations [
	[_size / 2, _size / 2, 0],
	["NameCityCapital", "NameCity", "NameVillage", "NameLocal", "Hill", "NameMarine", "Airport"],
	_size
]);

diag_log "GRADTOPO|END";
["done - you can close the game"] call _say;
hint "GRADTOPO: done";
};
