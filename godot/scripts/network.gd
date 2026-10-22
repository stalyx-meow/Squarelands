class_name SquarelandsConnection
extends Node
signal message(value: Dictionary)
signal connection_lost(reason: String)
var tcp := StreamPeerTCP.new()
var stream: StreamPeer
var secure: StreamPeerTLS
var incoming := PackedByteArray()
var outgoing := PackedByteArray()
var connected := false
var connecting := false
var host := ""
var use_tls := false
var sequence := 0
var started := 0
var heartbeat := 0.0
const MAX_FRAME := 64 * 1024 * 1024

func open(address: String) -> Error:
	close()
	var text := address.strip_edges()
	use_tls = text.begins_with("tls://")
	text = text.trim_prefix("tcp://").trim_prefix("tls://")
	var port := 3211
	if text.begins_with("["):
		var end := text.find("]")
		if end < 0: return ERR_INVALID_PARAMETER
		host = text.substr(1, end - 1)
		if text.length() > end + 1:
			if not text.substr(end + 1).begins_with(":") or not text.substr(end + 2).is_valid_int(): return ERR_INVALID_PARAMETER
			port = text.substr(end + 2).to_int()
	elif text.count(":") == 1:
		var parts := text.split(":")
		host = parts[0]
		if not parts[1].is_valid_int(): return ERR_INVALID_PARAMETER
		port = parts[1].to_int()
	else:
		host = text
	if host.is_empty() or "/" in host or "@" in host or port < 1 or port > 65535: return ERR_INVALID_PARAMETER
	tcp = StreamPeerTCP.new()
	var error := tcp.connect_to_host(host, port)
	if error != OK: return error
	connecting = true
	started = Time.get_ticks_msec()
	return OK

func close() -> void:
	connecting = false
	connected = false
	incoming.clear()
	outgoing.clear()
	stream = null
	secure = null
	tcp.disconnect_from_host()

func request(op: String, data: Dictionary = {}, world: String = "") -> int:
	sequence += 1
	var payload := JSON.stringify({"id": sequence, "op": op, "data": data, "world": world}).to_utf8_buffer()
	if payload.size() > 32768:
		message.emit({"id":sequence,"ok":false,"error":"Request too large / 请求过大"})
		return sequence
	var frame := PackedByteArray()
	frame.resize(4)
	frame[0]=(payload.size() >> 24) & 255
	frame[1]=(payload.size() >> 16) & 255
	frame[2]=(payload.size() >> 8) & 255
	frame[3]=payload.size() & 255
	frame.append_array(payload)
	outgoing.append_array(frame)
	return sequence

func fail(reason: String) -> void:
	close()
	connection_lost.emit(reason)

func _process(delta: float) -> void:
	if not connecting and not connected: return
	tcp.poll()
	var status := tcp.get_status()
	if status == StreamPeerTCP.STATUS_ERROR or (connected and status == StreamPeerTCP.STATUS_NONE):
		fail("Connection lost / 连接已断开")
		return
	if connecting and Time.get_ticks_msec() - started > 12000:
		fail("Connection timeout / 连接超时")
		return
	if status != StreamPeerTCP.STATUS_CONNECTED: return
	if stream == null:
		tcp.set_no_delay(true)
		if use_tls:
			secure = StreamPeerTLS.new()
			if secure.connect_to_stream(tcp, host, TLSOptions.client()) != OK:
				fail("TLS setup failed")
				return
			stream = secure
		else: stream = tcp
	if use_tls:
		secure.poll()
		if secure.get_status() == StreamPeerTLS.STATUS_HANDSHAKING: return
		if secure.get_status() != StreamPeerTLS.STATUS_CONNECTED:
			fail("TLS certificate/handshake failed / TLS 证书或握手失败")
			return
	connected = true
	connecting = false
	heartbeat += delta
	if heartbeat > 25:
		heartbeat = 0
		request("hello")
	if not outgoing.is_empty():
		var sent := stream.put_partial_data(outgoing)
		if sent[0] != OK:
			fail("Send failed")
			return
		outgoing = outgoing.slice(int(sent[1]))
	var count := stream.get_available_bytes()
	if count > 0:
		var received := stream.get_partial_data(mini(count, 1024 * 1024))
		if received[0] != OK:
			fail("Receive failed")
			return
		incoming.append_array(received[1])
	while incoming.size() >= 4:
		var length := (int(incoming[0]) << 24) | (int(incoming[1]) << 16) | (int(incoming[2]) << 8) | int(incoming[3])
		if length < 1 or length > MAX_FRAME:
			fail("Invalid frame length")
			return
		if incoming.size() < length + 4: break
		var value = JSON.parse_string(incoming.slice(4, length + 4).get_string_from_utf8())
		incoming = incoming.slice(length + 4)
		if not value is Dictionary:
			fail("Invalid server message")
			return
		message.emit(value)
