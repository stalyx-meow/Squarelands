extends SceneTree
const ClientNetwork=preload("res://scripts/network.gd")
func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	for item in [["frp-top.com:27767","frp-top.com",27767,false],["tcp://host-name.example:3211","host-name.example",3211,false],["tls://game.example.com:443","game.example.com",443,true],[" localhost：3211 ","localhost",3211,false],["127.0.0.1","127.0.0.1",3211,false],["[::1]:1234","::1",1234,false],["::1","::1",3211,false]]:
		var parsed:Dictionary=ClientNetwork.parse_address(item[0])
		assert(not parsed.has("error"),item[0])
		assert(parsed.host==item[1] and parsed.port==item[2] and parsed.tls==item[3],item[0])
	for value in ["","http://host:3210","https://host:443","host/path","name:0","name:65536","name:","[::1","user@host:3211","bad host:3211","-bad.example:1"]:
		assert(ClientNetwork.parse_address(value).has("error"),value)
	print("NATIVE_ADDRESS_CASES_PASS")
	var port := OS.get_environment("SQUARELANDS_FAKE_HTTP_PORT")
	if port.is_empty():quit();return
	var client := ClientNetwork.new()
	root.add_child(client)
	client.connection_lost.connect(func(reason):
		assert("HTTP endpoint" in reason)
		print("NATIVE_PROTOCOL_DIAGNOSTIC_PASS")
		quit())
	assert(client.open("127.0.0.1:"+port)==OK)
	client.request("hello")

