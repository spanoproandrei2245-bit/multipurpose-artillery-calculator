GRAD_hitGen = (missionNamespace getVariable ["GRAD_hitGen", 0]) + 1;
GRAD_hitDist = 2000;
GRAD_hitMiss = "none";
private _veh = vehicle player;
private _muzzle = (getPosASL _veh) vectorAdd [0, 0, 2];
private _dir = _veh weaponDirection "cannon_120mm";
private _flat = [_dir select 0, _dir select 1, 0];
_flat = vectorNormalized _flat;
private _xy = (getPosASL _veh) vectorAdd (_flat vectorMultiply GRAD_hitDist);
private _tz = getTerrainHeightASL [_xy select 0, _xy select 1];
GRAD_hitPos = [_xy select 0, _xy select 1, _tz];
if (!isNil "GRAD_hitObj") then { deleteVehicle GRAD_hitObj; };
GRAD_hitObj = createVehicle ["Sign_Sphere100cm_F", ASLToAGL GRAD_hitPos, [], 0, "CAN_COLLIDE"];
GRAD_hitObj setPosASL (GRAD_hitPos vectorAdd [0, 0, 0.5]);
GRAD_hitMuzzle = _muzzle;
if (!isNil "GRAD_hitEh") then { if (!isNull GRAD_hitVeh) then { GRAD_hitVeh removeEventHandler ["Fired", GRAD_hitEh]; }; };
GRAD_hitVeh = _veh;
GRAD_hitEh = _veh addEventHandler ["Fired", {
	params ["_unit", "_weapon", "", "", "_ammo", "", "_proj"];
	if (_weapon != "cannon_120mm") exitWith {};
	[_proj] spawn {
		params ["_p"];
		private _p0 = getPosASL _p;
		private _last = _p0;
		while { !isNull _p } do { _last = getPosASL _p; sleep 0.01; };
		private _d2 = _p0 distance2D _last;
		GRAD_hitMiss = format ["range %1 (target %2) dz@end %3 miss3D %4", _d2 toFixed 1, GRAD_hitDist toFixed 0, (((_last select 2) - (GRAD_hitPos select 2)) toFixed 1), (_last distance GRAD_hitPos) toFixed 1];
	};
}];
[GRAD_hitGen] spawn {
	params ["_gen"];
	while { (missionNamespace getVariable ["GRAD_hitGen", 0]) == _gen } do {
		private _v = vehicle player;
		private _wd = _v weaponDirection "cannon_120mm";
		private _md = _v vectorWorldToModel _wd;
		private _dh = (GRAD_hitPos select 2) - ((getPosASL _v) select 2) - 1.93;
		hintSilent format ["REL %1 WORLD %2 PITCH %3 ZERO %4 | TGT dist %5 dh %6 | %7", (asin (_md select 2)) toFixed 2, (asin (_wd select 2)) toFixed 2, ((_v call BIS_fnc_getPitchBank) select 0) toFixed 2, currentZeroing player, ((getPosASL _v) distance2D GRAD_hitPos) toFixed 1, _dh toFixed 2, GRAD_hitMiss];
		sleep 0.2;
	};
};
systemChat "GRAD: hit test target placed";
