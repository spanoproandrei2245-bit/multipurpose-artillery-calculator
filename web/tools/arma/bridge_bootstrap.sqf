[] spawn {
	missionNamespace setVariable ["gradBridgeId", (missionNamespace getVariable ["gradBridgeId", 0]) + 1];
	private _id = missionNamespace getVariable "gradBridgeId";
	private _base = "";
	{
		if (_base == "" && {fileExists (_x + "bridge.txt")}) then { _base = _x; };
	} forEach ["\gradbridge\", "gradbridge\"];
	diag_log format ["GRADBRIDGE|start|%1", _base];
	if (_base == "") exitWith {
		systemChat "GRADBRIDGE: folder not found - start the game with -filePatching";
		diag_log "GRADBRIDGE|error|no-folder";
	};
	private _last = 0;
	while {fileExists (_base + format ["cmd_%1.sqf", _last + 1])} do { _last = _last + 1; };
	systemChat format ["GRADBRIDGE: ready (%1)", _last];
	diag_log format ["GRADBRIDGE|ready|%1", _last];
	while {(missionNamespace getVariable "gradBridgeId") == _id} do {
		private _file = _base + format ["cmd_%1.sqf", _last + 1];
		if (fileExists _file) then {
			_last = _last + 1;
			uiSleep 0.2;
			private _code = loadFile _file;
			diag_log format ["GRADBRIDGE|run|%1|%2", _last, count _code];
			private _res = [] call compile _code;
			diag_log format ["GRADBRIDGE|done|%1|%2", _last, if (isNil "_res") then {"nil"} else {str _res}];
		};
		uiSleep 0.25;
	};
};
