private _veh = vehicle player;
if (_veh == player) then { _veh = cursorObject; };
private _cls = typeOf _veh;
private _cfg = configFile >> "CfgVehicles" >> _cls;

GRAD_out = [];
GRAD_weapons = [];
GRAD_mags = [];

GRAD_dumpTurret = {
	params ["_c", "_path"];
	GRAD_out pushBack format [
		"turret|%1|minElev=%2|maxElev=%3|minTurn=%4|maxTurn=%5|weapons=%6|mags=%7",
		_path, getNumber (_c >> "minElev"), getNumber (_c >> "maxElev"),
		getNumber (_c >> "minTurn"), getNumber (_c >> "maxTurn"),
		getArray (_c >> "weapons"), getArray (_c >> "magazines")
	];
	{ GRAD_weapons pushBackUnique _x; } forEach getArray (_c >> "weapons");
	{ GRAD_mags pushBackUnique _x; } forEach getArray (_c >> "magazines");
	private _sub = _c >> "Turrets";
	for "_i" from 0 to (count _sub - 1) do {
		private _s = _sub select _i;
		if (isClass _s) then { [_s, _path + "/" + configName _s] call GRAD_dumpTurret; };
	};
};

GRAD_out pushBack format ["vehicle|%1|%2|%3|%4", _cls, getText (_cfg >> "displayName"), getText (_cfg >> "author"), getNumber (_cfg >> "armor")];
private _turrets = _cfg >> "Turrets";
for "_i" from 0 to (count _turrets - 1) do {
	private _s = _turrets select _i;
	if (isClass _s) then { [_s, configName _s] call GRAD_dumpTurret; };
};

{
	private _w = configFile >> "CfgWeapons" >> _x;
	private _muzzles = getArray (_w >> "muzzles");
	GRAD_out pushBack format [
		"weapon|%1|%2|initSpeed=%3|muzzles=%4|mags=%5",
		_x, getText (_w >> "displayName"), getNumber (_w >> "initSpeed"), _muzzles, getArray (_w >> "magazines")
	];
	{
		private _m = if (_x == "this") then { _w } else { _w >> _x };
		{ GRAD_mags pushBackUnique _x; } forEach getArray (_m >> "magazines");
		private _modes = getArray (_m >> "modes");
		{
			private _mode = _m >> _x;
			GRAD_out pushBack format [
				"mode|%1|%2|reloadTime=%3|dispersion=%4|minRange=%5|midRange=%6|maxRange=%7|magazineReloadTime=%8|initSpeed=%9",
				configName _w, _x, getNumber (_mode >> "reloadTime"), getNumber (_mode >> "dispersion"),
				getNumber (_mode >> "minRange"), getNumber (_mode >> "midRange"), getNumber (_mode >> "maxRange"),
				getNumber (_m >> "magazineReloadTime"), getNumber (_mode >> "initSpeed")
			];
		} forEach _modes;
	} forEach _muzzles;
} forEach GRAD_weapons;

GRAD_ammos = [];
{
	private _m = configFile >> "CfgMagazines" >> _x;
	private _ammo = getText (_m >> "ammo");
	GRAD_ammos pushBackUnique _ammo;
	GRAD_out pushBack format [
		"magazine|%1|%2|ammo=%3|count=%4|initSpeed=%5|mass=%6",
		_x, getText (_m >> "displayName"), _ammo, getNumber (_m >> "count"), getNumber (_m >> "initSpeed"), getNumber (_m >> "mass")
	];
} forEach GRAD_mags;

{
	private _a = configFile >> "CfgAmmo" >> _x;
	GRAD_out pushBack format [
		"ammo|%1|simulation=%2|initSpeed=%3|typicalSpeed=%4|maxSpeed=%5|airFriction=%6|sideAirFriction=%7|timeToLive=%8|caliber=%9|hit=%10|indirectHit=%11|indirectHitRange=%12|explosive=%13|deflecting=%14|fuseDistance=%15|submunition=%16",
		_x, getText (_a >> "simulation"), getNumber (_a >> "initSpeed"), getNumber (_a >> "typicalSpeed"),
		getNumber (_a >> "maxSpeed"), getNumber (_a >> "airFriction"), getNumber (_a >> "sideAirFriction"),
		getNumber (_a >> "timeToLive"), getNumber (_a >> "caliber"), getNumber (_a >> "hit"),
		getNumber (_a >> "indirectHit"), getNumber (_a >> "indirectHitRange"), getNumber (_a >> "explosive"),
		getNumber (_a >> "deflecting"), getNumber (_a >> "fuseDistance"), getText (_a >> "submunitionAmmo")
	];
} forEach GRAD_ammos;

GRAD_out pushBack format ["selected|%1|%2", _veh currentWeaponTurret [0], _veh currentMagazineTurret [0]];

{ diag_log ("GRADBRIDGE|data|" + _x); } forEach GRAD_out;
copyToClipboard (GRAD_out joinString endl);
systemChat format ["GRAD: %1 lines for %2 copied and written to RPT", count GRAD_out, _cls];
